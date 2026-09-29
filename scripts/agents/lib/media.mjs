// Media Enricher: adds artwork + 30s preview + Apple Music link to each track via the public iTunes Search API.
// Results are reused from the previous trends.json by id, so daily runs only look up new tracks
// (iTunes allows roughly 20 requests/minute).
import { slugify } from './normalize.mjs';

const SEARCH = 'https://itunes.apple.com/search';
const DELAY_MS = 3200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const primaryArtist = (s) => slugify(String(s).split(/,|&| feat\.?| ft\.?| x | with /i)[0]);
const baseTitle = (s) => slugify(String(s).replace(/\s*[([].*?[)\]]/g, '').split(' - ')[0]);

function score(result, track) {
  const want = baseTitle(track.track);
  const got = baseTitle(result.trackName ?? '');
  const artistOk = slugify(result.artistName ?? '').includes(primaryArtist(track.artist));
  const titleOk = got === want || got.startsWith(want) || want.startsWith(got);
  return (titleOk ? 2 : 0) + (artistOk ? 1 : 0);
}

async function search(term, country, attempt = 0) {
  const url = `${SEARCH}?${new URLSearchParams({ term, country, entity: 'song', limit: '10', media: 'music' })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if ((res.status === 403 || res.status === 429) && attempt < 3) {
    await sleep(20_000 * (attempt + 1)); // rate limited — back off
    return search(term, country, attempt + 1);
  }
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  return (await res.json()).results ?? [];
}

async function lookup(track, country) {
  const term = `${track.artist.split(/,|&| feat\.?/i)[0]} ${track.track.replace(/\s*[([].*?[)\]]/g, '')}`;
  const results = await search(term, country);
  const best = results
    .map((r) => ({ r, s: score(r, track) }))
    .filter(({ s }) => s === 3)
    .sort((a, b) => Number(Boolean(b.r.previewUrl)) - Number(Boolean(a.r.previewUrl)))[0]?.r;
  if (!best) return null;
  return {
    artwork_url: best.artworkUrl100?.replace(/\/\d+x\d+bb\./, '/200x200bb.') ?? null,
    preview_url: best.previewUrl ?? null,
    apple_music_url: best.trackViewUrl?.replace(/[?&]uo=\d+/, '') ?? null,
  };
}

const EMPTY = { artwork_url: null, preview_url: null, apple_music_url: null };

/**
 * @param {object[]} tracks  normalized tracks
 * @param {'global'|'tr'} region
 * @param {Map<string, object>} previous  id -> previous track (media fields reused)
 */
export async function enrichMedia(tracks, region, previous, log = () => {}) {
  const country = region === 'tr' ? 'tr' : 'us';
  let looked = 0;
  let found = 0;
  const out = [];
  for (const t of tracks) {
    const prev = previous.get(t.id);
    if (prev?.artwork_url || prev?.preview_url) {
      out.push({ ...t, artwork_url: prev.artwork_url, preview_url: prev.preview_url, apple_music_url: prev.apple_music_url });
      continue;
    }
    if (looked++) await sleep(DELAY_MS);
    let media = null;
    try {
      media = await lookup(t, country);
      if (!media && country === 'tr') {
        await sleep(DELAY_MS);
        media = await lookup(t, 'us');
      }
    } catch (e) {
      log(`⚠ ${t.artist} – ${t.track}: ${e.message}`);
    }
    if (media) found++;
    out.push({ ...t, ...(media ?? EMPTY) });
  }
  const withPreview = out.filter((t) => t.preview_url).length;
  log(`${looked} looked up (${found} matched), ${tracks.length - looked} reused · ${withPreview}/${out.length} with preview`);
  return out;
}
