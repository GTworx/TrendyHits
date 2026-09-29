#!/usr/bin/env node
// Music Newsletter Dispatcher Agent: trends.json + /api/likes -> TR & EN HTML newsletters -> Kit Broadcasts.
//
//   npm run agents:newsletter                 # dry run: writes out/newsletter-{tr,en}.html, sends nothing
//   npm run agents:newsletter -- --draft      # creates Kit broadcasts as drafts (send_at: null)
//   npm run agents:newsletter -- --send       # schedules broadcasts (send_at: now + 10 min, or --send-at=ISO)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { args, argValue, log } from './lib/env.mjs';
import { generate } from './lib/gemini.mjs';
import { NEWSLETTER_PROMPT } from './lib/prompts.mjs';
import { kit, languageTagId } from '../../shared/kit.mjs';

const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const MODE = args.has('--send') ? 'send' : args.has('--draft') ? 'draft' : 'dry-run';
// Sent Mondays and Fridays: Friday (and weekend) editions get the weekend subject line
const EDITION = argValue('edition', [5, 6, 0].includes(new Date().getUTCDay()) ? 'weekend' : 'week');
const subjectFor = (lang) => (EDITION === 'weekend' ? COPY[lang].subjectWeekend : COPY[lang].subject);

const COPY = {
  tr: {
    subject: '🎧 Haftanın Hit Parçaları: Global & Türkiye Trendleri',
    subjectWeekend: '🎧 Hafta Sonu Hitleri: Global & Türkiye Trendleri',
    global: '🌍 Global Top Hits',
    turkey: '🇹🇷 Türkiye Top Hits',
    favorites: '❤️ Topluluğun Favorileri',
    likes: 'beğeni',
    cta: 'En çok beğendiğin parçayı oylamak için sitemizi ziyaret et!',
    footer: 'Bu bülteni TrendyHits abonesi olduğun için alıyorsun.',
    locale: 'tr-TR',
  },
  en: {
    subject: "🎧 This Week's Hits: Global & Turkey Trends",
    subjectWeekend: "🎧 Weekend Hits: Global & Turkey Trends",
    global: '🌍 Global Top Hits',
    turkey: '🇹🇷 Turkey Top Hits',
    favorites: '❤️ Community Favorites',
    likes: 'likes',
    cta: 'Visit our site to vote for your favorite track!',
    footer: "You're receiving this because you subscribed to TrendyHits.",
    locale: 'en-US',
  },
};

// ---------- 1. DATA GATHERING ----------
async function gather() {
  let trends;
  let likes = {};
  if (SITE_URL) {
    log('Newsletter', `fetching ${SITE_URL}/data/trends.json + /api/likes`);
    trends = await fetch(`${SITE_URL}/data/trends.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`trends ${r.status}`))));
    likes = await fetch(`${SITE_URL}/api/likes`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  } else {
    log('Newsletter', 'SITE_URL not set — using local public/data/trends.json and no likes');
    trends = JSON.parse(readFileSync('public/data/trends.json', 'utf8'));
  }
  const withLikes = (list) => list.map((t) => ({ ...t, likes: Number(likes[t.id] ?? 0) }));
  const topLiked = (list) => [...list].filter((t) => t.likes > 0).sort((a, b) => b.likes - a.likes).slice(0, 3);
  const global = withLikes(trends.global_trends);
  const turkey = withLikes(trends.turkey_trends);
  const favorites = new Set([...topLiked(global), ...topLiked(turkey)].map((t) => t.id));
  return { global, turkey, favorites, last_updated: trends.last_updated };
}

// ---------- 2. CONTENT COMPILATION ----------
async function editorial(data) {
  const brief = (list) => list.slice(0, 10).map((t) => `${t.rank}. ${t.artist} – ${t.track} (${t.note_en}; ${t.likes} likes)`).join('\n');
  const { text } = await generate({
    system: NEWSLETTER_PROMPT,
    prompt: `WORKFLOW adım 2 için sadece editoryal metinleri üret (HTML'i kod oluşturacak).
Global ilk 10:\n${brief(data.global)}\n\nTürkiye ilk 10:\n${brief(data.turkey)}

Bu sayı: ${EDITION === 'weekend' ? 'Cuma / hafta sonu sayısı (hafta sonuna enerjik bir kapanış)' : 'Pazartesi / hafta başı sayısı (haftaya enerjik bir başlangıç)'}.
Kurallar: preview_text 1 cümle, konu satırını tekrar etmesin. intro 2-3 cümle, enerjik; somut sanatçı/parça adları geçsin.
EN metinleri TR'nin çevirisi DEĞİL, doğal İngilizce yazılmış olsun. Emoji en fazla 1.`,
    schema: {
      type: 'OBJECT',
      properties: {
        tr: { type: 'OBJECT', properties: { preview_text: { type: 'STRING' }, intro: { type: 'STRING' } }, required: ['preview_text', 'intro'] },
        en: { type: 'OBJECT', properties: { preview_text: { type: 'STRING' }, intro: { type: 'STRING' } }, required: ['preview_text', 'intro'] },
      },
      required: ['tr', 'en'],
    },
    temperature: 0.8,
  });
  return JSON.parse(text);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function column(title, list, lang, favorites) {
  const c = COPY[lang];
  const nf = new Intl.NumberFormat(c.locale);
  const rows = list
    .map((t) => {
      const fav = favorites.has(t.id);
      const note = lang === 'tr' ? t.note_tr : t.note_en;
      const art = t.artwork_url
        ? `<img src="${esc(t.artwork_url)}" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border-radius:6px;border:0;">`
        : `<div style="width:40px;height:40px;border-radius:6px;background:#c026d3;"></div>`;
      const title = t.apple_music_url
        ? `<a href="${esc(t.apple_music_url)}" style="color:#18181b;text-decoration:none;">${esc(t.track)}</a>`
        : esc(t.track);
      return `<tr><td style="padding:10px 8px 10px 12px;border-bottom:1px solid #eeeef2;vertical-align:top;width:22px;font:800 14px/20px Arial,sans-serif;color:${t.rank <= 3 ? '#f43f5e' : '#a1a1aa'};">${t.rank}</td>
<td style="padding:10px 10px 10px 0;border-bottom:1px solid #eeeef2;vertical-align:top;width:40px;">${art}</td>
<td style="padding:10px 0;border-bottom:1px solid #eeeef2;font:600 14px/20px Arial,sans-serif;color:#18181b;">${title}${fav ? ' <span style="font-size:12px;">❤️</span>' : ''}<br><span style="font-weight:400;color:#71717a;font-size:13px;">${esc(t.artist)}</span>${note ? `<br><span style="font-weight:400;color:#a1a1aa;font-size:12px;">${esc(note)}</span>` : ''}</td>
<td style="padding:10px 12px;border-bottom:1px solid #eeeef2;text-align:right;vertical-align:top;white-space:nowrap;font:600 12px/20px Arial,sans-serif;color:#e11d48;">♥ ${nf.format(t.likes)}</td></tr>`;
    })
    .join('\n');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;border-collapse:separate;overflow:hidden;">
<tr><td colspan="4" style="padding:14px 12px;font:800 17px/24px Arial,sans-serif;color:#18181b;border-bottom:1px solid #e4e4e7;">${title}</td></tr>
${rows}</table>`;
}

function favoritesBlock(data, lang) {
  const c = COPY[lang];
  const favs = [...data.global, ...data.turkey].filter((t) => data.favorites.has(t.id)).sort((a, b) => b.likes - a.likes);
  if (!favs.length) return '';
  const nf = new Intl.NumberFormat(c.locale);
  const items = favs.map((t) => `<li style="margin:4px 0;">${esc(t.artist)} – <b>${esc(t.track)}</b> <span style="color:#e11d48;">♥ ${nf.format(t.likes)} ${c.likes}</span></li>`).join('');
  return `<tr><td style="padding:0 0 20px;"><div style="background:#fff1f2;border-radius:12px;padding:14px 18px;font:14px/20px Arial,sans-serif;color:#18181b;"><b>${c.favorites}</b><ul style="margin:8px 0 0;padding-left:18px;">${items}</ul></div></td></tr>`;
}

function buildHtml(data, lang, copy) {
  const c = COPY[lang];
  const siteLink = `${SITE_URL || 'https://trendyhits.netlify.app'}/${lang}/`;
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subjectFor(lang))}</title>
<style>@media (max-width:620px){.col{display:block!important;width:100%!important;padding:0 0 16px!important}}</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(copy.preview_text)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;">
<tr><td style="padding:28px 24px;background:linear-gradient(135deg,#f43f5e,#c026d3,#4f46e5);background-color:#c026d3;border-radius:16px 16px 0 0;color:#ffffff;">
<div style="font:800 26px/32px Arial,sans-serif;">🎧 TrendyHits</div>
<div style="font:15px/22px Arial,sans-serif;margin-top:10px;opacity:.95;">${esc(copy.intro)}</div></td></tr>
<tr><td style="background:#fafafa;padding:20px 24px 4px;border-radius:0 0 16px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${favoritesBlock(data, lang)}
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td class="col" width="50%" valign="top" style="padding:0 8px 16px 0;">${column(c.global, data.global, lang, data.favorites)}</td>
<td class="col" width="50%" valign="top" style="padding:0 0 16px 8px;">${column(c.turkey, data.turkey, lang, data.favorites)}</td>
</tr></table></td></tr>
<tr><td align="center" style="padding:8px 0 28px;"><a href="${siteLink}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font:700 15px/20px Arial,sans-serif;padding:14px 22px;border-radius:999px;">${esc(c.cta)}</a></td></tr>
</table></td></tr>
<tr><td align="center" style="padding:16px;font:12px/18px Arial,sans-serif;color:#a1a1aa;">${esc(c.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

// ---------- 3. DISPATCH ----------
async function dispatch(lang, html, copy) {
  const tagId = await languageTagId(lang);
  const sendAt = MODE === 'send' ? argValue('send-at', new Date(Date.now() + 10 * 60_000).toISOString()) : null;
  const body = {
    subject: subjectFor(lang),
    preview_text: copy.preview_text,
    description: `TrendyHits bülten (${EDITION === 'weekend' ? 'Cuma' : 'Pazartesi'}) - ${lang.toUpperCase()}`,
    content: html,
    public: false,
    send_at: sendAt,
    subscriber_filter: [{ all: [{ type: 'tag', ids: [tagId] }], any: null, none: null }],
    ...(process.env.KIT_SENDER_EMAIL && { email_address: process.env.KIT_SENDER_EMAIL }),
  };
  const { broadcast } = await kit('/broadcasts', { method: 'POST', body });
  log('Newsletter', `✔ ${lang.toUpperCase()} broadcast #${broadcast.id} (tag ${tagId}) ${sendAt ? `scheduled for ${sendAt}` : 'saved as draft'}`);
  return broadcast.id;
}

async function main() {
  const data = await gather();
  log('Newsletter', `${data.global.length} global + ${data.turkey.length} TR tracks, ${data.favorites.size} community favorites`);
  const copy = await editorial(data);

  mkdirSync('out', { recursive: true });
  const html = {};
  for (const lang of ['tr', 'en']) {
    html[lang] = buildHtml(data, lang, copy[lang]);
    writeFileSync(`out/newsletter-${lang}.html`, html[lang]);
  }
  log('Newsletter', 'wrote out/newsletter-tr.html, out/newsletter-en.html');

  if (MODE === 'dry-run') {
    if (process.env.KIT_API_KEY) {
      for (const lang of ['tr', 'en']) {
        const tagId = await languageTagId(lang);
        const { subscribers } = await kit(`/tags/${tagId}/subscribers?per_page=1000`);
        log('Newsletter', `${lang.toUpperCase()} audience: tag ${tagId} → ${subscribers.length} active subscriber(s) get newsletter-${lang}.html`);
      }
    }
    log('Newsletter', 'dry run — nothing sent (use --draft or --send)');
    return;
  }

  // 4. VERIFICATION: one failing language doesn't roll back the other, but the run fails.
  const results = await Promise.allSettled(['tr', 'en'].map((l) => dispatch(l, html[l], copy[l])));
  const failed = results.map((r, i) => [r, ['tr', 'en'][i]]).filter(([r]) => r.status === 'rejected');
  for (const [r, lang] of failed) console.error(`✖ ${lang.toUpperCase()} broadcast failed: ${r.reason.message}`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(`✖ ${e.message}`);
  process.exit(1);
});
