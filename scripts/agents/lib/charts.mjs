// Chart tools for the research agents: fetch current public chart data so the LLM works from real rankings.
const UA = { 'User-Agent': 'Mozilla/5.0 (TrendyHits chart agent; +https://github.com/GTworx/TrendyHits)' };

const decode = (s) =>
  s
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

async function get(url, type = 'text', attempt = 0) {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return type === 'json' ? await res.json() : await res.text();
  } catch (e) {
    if (attempt < 2) return get(url, type, attempt + 1);
    throw e;
  }
}

/** Apple Music "most played" feed. cc: 'us' | 'gb' | 'tr' … */
async function appleMusic(cc, limit = 50) {
  const data = await get(`https://rss.marketingtools.apple.com/api/v2/${cc}/music/most-played/${limit}/songs.json`, 'json');
  return data.feed.results.map((r, i) => ({ rank: i + 1, artist: r.artistName, track: r.name }));
}

/** Spotify daily chart mirrored by kworb.net. country: 'global' | 'tr' | … */
async function spotifyDaily(country, limit = 50) {
  const html = await get(`https://kworb.net/spotify/country/${country}_daily.html`);
  const rows = [...html.matchAll(/<td class="text mp"><div>(.*?)<\/div><\/td>/g)].slice(0, limit);
  return rows.map((m, i) => {
    const [artist, ...rest] = decode(m[1].replace(/<[^>]+>/g, '')).split(' - ');
    return { rank: i + 1, artist, track: rest.join(' - ') };
  });
}

async function billboardHot100(limit = 50) {
  const html = await get('https://www.billboard.com/charts/hot-100/');
  return html
    .split('o-chart-results-list-row-container')
    .slice(1, limit + 1)
    .map((row, i) => {
      const track = row.match(/id="title-of-a-story"[^>]*>([\s\S]*?)<\/h3>/)?.[1];
      const artist = row.match(/<\/h3>\s*<span[^>]*>([\s\S]*?)<\/span>/)?.[1];
      return { rank: i + 1, artist: decode((artist ?? '').replace(/<[^>]+>/g, '')), track: decode(track ?? '') };
    })
    .filter((r) => r.track && r.artist);
}

/** YouTube trending (TR) — mixed content; the agent keeps only music videos. */
async function youtubeTrendingTR(limit = 50) {
  const html = await get('https://kworb.net/youtube/trending/tr.html');
  return [...html.matchAll(/<tr[^>]*><td>(\d+)<\/td><td>[^<]*<\/td><td class="text"><div><a[^>]*>(.*?)<\/a>/g)]
    .slice(0, limit)
    .map((m) => ({ rank: Number(m[1]), title: decode(m[2]) }));
}

export const CHART_TOOLS = {
  global: [
    { source: 'Spotify Global (daily)', run: () => spotifyDaily('global') },
    { source: 'Billboard Hot 100', run: () => billboardHot100() },
    { source: 'Apple Music US', run: () => appleMusic('us') },
    { source: 'Apple Music UK', run: () => appleMusic('gb') },
  ],
  tr: [
    { source: 'Spotify TR (daily)', run: () => spotifyDaily('tr') },
    { source: 'Apple Music TR', run: () => appleMusic('tr') },
    { source: 'YouTube TR (trending)', run: () => youtubeTrendingTR() },
  ],
};

/** Runs every tool for a region in parallel; failures are reported but don't abort the run. */
export async function fetchCharts(region, onError = () => {}) {
  const results = await Promise.allSettled(CHART_TOOLS[region].map((t) => t.run()));
  return results.flatMap((r, i) => {
    const { source } = CHART_TOOLS[region][i];
    if (r.status === 'rejected' || !r.value.length) {
      onError(source, r.reason?.message ?? 'empty');
      return [];
    }
    return [{ source, items: r.value }];
  });
}
