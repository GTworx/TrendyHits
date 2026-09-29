// Deterministic validation layer that runs after the LLM Formatter/Validator agent.
const TR_MAP = { ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u' };

export function slugify(s) {
  return String(s)
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_MAP[c])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function trackId(region, artist, track) {
  return `${region}-${slugify(artist)}-${slugify(track)}`.slice(0, 128).replace(/-+$/, '');
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const limitWords = (s, n = 8) => clean(s).split(' ').slice(0, n).join(' ');

/**
 * Builds a schema-valid list: trims fields, assigns stable ids (reusing previous ids for the same song),
 * drops duplicates/invalid rows and renumbers ranks.
 */
export function normalizeList(items, region, previous = []) {
  const prevByTrack = new Map(previous.map((p) => [`${slugify(p.track)}|${slugify(p.artist).split('-')[0]}`, p.id]));
  const seen = new Set();
  const out = [];

  for (const it of items ?? []) {
    const artist = clean(it.artist);
    const track = clean(it.track);
    if (!artist || !track) continue;

    const key = `${slugify(track)}|${slugify(artist).split('-')[0]}`;
    const id = prevByTrack.get(key) ?? trackId(region, artist, track);
    if (seen.has(id) || seen.has(key)) continue;
    seen.add(id).add(key);

    out.push({
      id,
      rank: out.length + 1,
      artist,
      track,
      note_tr: limitWords(it.note_tr),
      note_en: limitWords(it.note_en),
      source: clean(it.source) || (region === 'tr' ? 'Spotify TR' : 'Spotify Global'),
    });
  }
  return out;
}

export function validateTrends(data, min = 20) {
  const errors = [];
  if (Number.isNaN(Date.parse(data.last_updated))) errors.push('last_updated is not ISO 8601');
  for (const listName of ['global_trends', 'turkey_trends']) {
    const list = data[listName];
    if (!Array.isArray(list) || list.length < min) {
      errors.push(`${listName} has ${list?.length ?? 0} tracks (min ${min})`);
      continue;
    }
    list.forEach((t, i) => {
      for (const f of ['id', 'artist', 'track', 'note_tr', 'note_en', 'source']) {
        if (typeof t[f] !== 'string' || !t[f]) errors.push(`${listName}[${i}].${f} missing`);
      }
      if (t.rank !== i + 1) errors.push(`${listName}[${i}].rank should be ${i + 1}`);
    });
  }
  if (data.global_trends?.length !== data.turkey_trends?.length) errors.push('lists are not balanced');
  return errors;
}
