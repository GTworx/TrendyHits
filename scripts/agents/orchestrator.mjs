#!/usr/bin/env node
// Orchestrator Agent: runs the Global + TR research agents in parallel, hands their output to the
// Formatter/Validator agent, validates deterministically and writes public/data/trends.json.
//
//   npm run agents:trends                 # research + write public/data/trends.json
//   npm run agents:trends -- --dry-run    # research, print summary, don't write
//   npm run agents:trends -- --table --lang=tr   # print the side-by-side Markdown table (chat/preview mode)
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { args, argValue, log } from './lib/env.mjs';
import { generate, parseJsonLoose } from './lib/gemini.mjs';
import { ORCHESTRATOR_PROMPT } from './lib/prompts.mjs';
import { normalizeList, slugify, validateTrends } from './lib/normalize.mjs';
import { fetchCharts } from './lib/charts.mjs';

const OUT = 'public/data/trends.json';
const TARGET = Number(argValue('count', 25));
const today = new Date().toISOString().slice(0, 10);

const RESEARCHERS = {
  global: {
    name: 'GlobalAgent',
    task: `Global Music Trend Agent (Araştırmacı 1) olarak yalnızca WORKFLOW adım 1'i (GLOBAL RESEARCH) uygula.
Bugünün tarihi: ${today}. Güncel listeler: Spotify Top 50 Global, Billboard Hot 100, Apple Music (US/UK).
Listelerde en üst sıralarda olan ve kesişen ${TARGET + 5} yabancı parçayı popülerliğe göre sırala.`,
  },
  tr: {
    name: 'TRAgent',
    task: `TR Music Trend Agent (Araştırmacı 2) olarak yalnızca WORKFLOW adım 2'yi (TÜRKİYE RESEARCH) uygula.
Bugünün tarihi: ${today}. Güncel listeler: Spotify Top 50 Türkiye, Apple Music Türkiye, YouTube Türkiye trendler.
Türkiye'de şu an en çok dinlenen ${TARGET + 5} YERLİ (Türk sanatçı / Türkçe) parçayı popülerliğe göre sırala.`,
  },
};

const RESEARCH_FORMAT = `
Yanıtını SADECE bir \`\`\`json kod bloğu olarak ver; başka metin yazma. Şema:
[{ "rank": 1, "artist": "...", "track": "...", "note": "tür / neden trend (kısa)", "source": "Spotify Global / Billboard" }]
"source" alanına parçanın göründüğü listeleri yaz. Sanatçı ve parça adlarını orijinal yazımıyla bırak;
uydurma parça ekleme — sadece CHART TOOL verisinde (veya aramada) doğrulananları yaz.`;

// WEB_SEARCH=off disables Google Search grounding; by default it's tried and skipped when the quota is unavailable.
let searchEnabled = process.env.WEB_SEARCH !== 'off';

/** Anti-hallucination guard: keep only tracks that appear in the fetched chart data. */
function groundedOnly(items, charts) {
  const corpus = charts.flatMap((c) => c.items.map((i) => slugify(i.track ?? i.title))).join('|');
  return items.filter((it) => {
    const s = slugify(it.track ?? '');
    return s && corpus.includes(s);
  });
}

async function research(region) {
  const { name, task } = RESEARCHERS[region];
  log(name, 'fetching chart tools…');
  const charts = await fetchCharts(region, (source, err) => log(name, `⚠ ${source}: ${err}`));
  if (!charts.length) throw new Error(`${name}: no chart source reachable`);
  log(name, `chart tools: ${charts.map((c) => `${c.source} (${c.items.length})`).join(', ')}`);

  const prompt = `${task}

# CHART TOOL OUTPUT (${today} itibarıyla canlı çekildi — birincil kaynak budur)
Birden fazla listede üst sıralarda olan parçaları öne al; YouTube başlıklarından sadece müzik videolarını değerlendir.
${JSON.stringify(charts)}
${RESEARCH_FORMAT}`;

  let result;
  if (searchEnabled) {
    try {
      result = await generate({ system: ORCHESTRATOR_PROMPT, prompt, search: true, temperature: 0.2 });
    } catch (e) {
      if (e.status !== 429 && e.status !== 400) throw e;
      searchEnabled = false;
      log(name, '⚠ Google Search grounding unavailable for this key, using chart tools only');
    }
  }
  result ??= await generate({ system: ORCHESTRATOR_PROMPT, prompt, temperature: 0.2 });

  const raw = parseJsonLoose(result.text);
  if (!Array.isArray(raw)) throw new Error(`${name}: expected a JSON array`);
  const items = result.sources.length ? raw : groundedOnly(raw, charts);
  log(name, `${items.length} candidates via ${result.model}${raw.length !== items.length ? ` (${raw.length - items.length} ungrounded dropped)` : ''}`);
  return items;
}

const TRACK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    artist: { type: 'STRING' },
    track: { type: 'STRING' },
    note_tr: { type: 'STRING' },
    note_en: { type: 'STRING' },
    source: { type: 'STRING' },
  },
  required: ['artist', 'track', 'note_tr', 'note_en', 'source'],
};
const VALIDATOR_SCHEMA = {
  type: 'OBJECT',
  properties: {
    global_trends: { type: 'ARRAY', items: TRACK_SCHEMA },
    turkey_trends: { type: 'ARRAY', items: TRACK_SCHEMA },
  },
  required: ['global_trends', 'turkey_trends'],
};

async function validate(globalRaw, trRaw) {
  log('Validator', 'normalizing, de-duplicating, writing TR/EN notes…');
  const { text } = await generate({
    system: ORCHESTRATOR_PROMPT,
    prompt: `Formatter/Validator Agent olarak WORKFLOW adım 3'ü (VALIDATION & NORMALIZATION) uygula.
Aşağıda araştırmacı ajanların ham çıktıları var. Görevin:
- Şarkıcı ve parça adlarının yazımını düzelt (resmi yazım; Türkçe karakterleri koru; "feat." biçimini tutarlı yap). ÇEVİRME.
- Duplicate parçaları kaldır. Global listede Türk yerli parça, Türkiye listesinde yabancı parça bırakma.
- Her parça için note_tr (Türkçe) ve note_en (doğal İngilizce) yaz: en fazla 8 kelime, tür + öne çıkan durum.
- Popülerlik sırasını koru. Her listeden TAM ${TARGET} parça döndür.
- id ve rank alanlarını ÜRETME (kod tarafından atanır).

GLOBAL (ham):
${JSON.stringify(globalRaw)}

TÜRKİYE (ham):
${JSON.stringify(trRaw)}`,
    schema: VALIDATOR_SCHEMA,
    temperature: 0.2,
  });
  return JSON.parse(text);
}

function readPrevious() {
  try {
    return existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  } catch {
    return null;
  }
}

function toTable(data, lang) {
  const head =
    lang === 'en'
      ? '| Rank | Global Trends (World) - Artist & Track | Rank | Turkey Trends - Artist & Track |'
      : '| Sıra | Global Trendler (Dünya) - Sanatçı & Parça | Sıra | Türkiye Trendleri - Sanatçı & Parça |';
  const rows = data.global_trends.map((g, i) => {
    const t = data.turkey_trends[i];
    return `| ${g.rank} | ${g.artist} - ${g.track} | ${t?.rank ?? ''} | ${t ? `${t.artist} - ${t.track}` : ''} |`;
  });
  return [head, '| :--- | :--- | :--- | :--- |', ...rows].join('\n');
}

async function main() {
  const previous = readPrevious();

  if (args.has('--table') && !args.has('--refresh') && previous) {
    console.log(toTable(previous, argValue('lang', 'tr')));
    return;
  }

  log('Orchestrator', `dispatching research agents in parallel (target ${TARGET}/list)`);
  const [globalRaw, trRaw] = await Promise.all([research('global'), research('tr')]);

  const validated = await validate(globalRaw, trRaw);
  let global_trends = normalizeList(validated.global_trends, 'global', previous?.global_trends);
  let turkey_trends = normalizeList(validated.turkey_trends, 'tr', previous?.turkey_trends);

  // Balance both columns to the same length
  const n = Math.min(TARGET, global_trends.length, turkey_trends.length);
  global_trends = global_trends.slice(0, n);
  turkey_trends = turkey_trends.slice(0, n);

  const data = { last_updated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), global_trends, turkey_trends };
  const errors = validateTrends(data);
  if (errors.length) {
    throw new Error(`Validation failed, ${OUT} left untouched:\n  - ${errors.join('\n  - ')}`);
  }

  const json = JSON.stringify(data, null, 2) + '\n';
  JSON.parse(json); // parse check before writing

  if (args.has('--table')) console.log(toTable(data, argValue('lang', 'tr')));
  if (args.has('--dry-run')) {
    log('Orchestrator', `dry run — ${n} + ${n} tracks, not written`);
    return;
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, json);
  log('Orchestrator', `✔ wrote ${OUT} (${n} global + ${n} TR)`);
  log('Orchestrator', `   #1 global: ${global_trends[0].artist} – ${global_trends[0].track}`);
  log('Orchestrator', `   #1 TR:     ${turkey_trends[0].artist} – ${turkey_trends[0].track}`);
}

main().catch((e) => {
  console.error(`✖ ${e.message}`);
  process.exit(1);
});
