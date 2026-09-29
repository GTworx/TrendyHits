import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface TrackRecord {
  id: string;
  track: string;
  artist: string;
  region: 'GLOBAL' | 'TR';
}

let cache: { at: number; tracks: Map<string, TrackRecord> } | null = null;
const TTL_MS = 60_000;

async function loadTrends(origin: string) {
  try {
    const res = await fetch(new URL('/data/trends.json', origin));
    if (res.ok) return await res.json();
  } catch {
    /* fall back to the bundled copy */
  }
  return JSON.parse(await readFile(resolve('public/data/trends.json'), 'utf8'));
}

/** Tracks from the currently deployed trends.json, keyed by id. Title/artist always come from here, never the client. */
export async function getTracks(origin: string): Promise<Map<string, TrackRecord>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.tracks;
  const trends = await loadTrends(origin);
  const tracks = new Map<string, TrackRecord>();
  for (const t of trends.global_trends ?? []) tracks.set(t.id, { ...t, region: 'GLOBAL' });
  for (const t of trends.turkey_trends ?? []) tracks.set(t.id, { ...t, region: 'TR' });
  cache = { at: Date.now(), tracks };
  return tracks;
}
