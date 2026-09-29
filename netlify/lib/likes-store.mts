// Likes persistence: Postgres (Netlify DB / Neon / Supabase) when a connection string is set,
// otherwise Netlify Blobs so the site works out of the box (incl. `netlify dev`).
import { neon } from '@neondatabase/serverless';
import { getStore } from '@netlify/blobs';
import type { TrackRecord } from './trends.mts';

const DB_URL = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;

const sql = DB_URL ? neon(DB_URL) : null;
let schemaReady: Promise<unknown> | null = null;

function ensureSchema() {
  schemaReady ??= sql!`
    CREATE TABLE IF NOT EXISTS tracks (
      id          VARCHAR(128) PRIMARY KEY,
      title       VARCHAR(255) NOT NULL,
      artist      VARCHAR(255) NOT NULL,
      region      VARCHAR(10)  NOT NULL CHECK (region IN ('GLOBAL', 'TR')),
      likes_count INT          NOT NULL DEFAULT 0,
      updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
  return schemaReady;
}

const blobs = () => getStore({ name: 'likes', consistency: 'strong' });

export async function getAllLikes(): Promise<Record<string, number>> {
  if (sql) {
    await ensureSchema();
    const rows = await sql`SELECT id, likes_count FROM tracks`;
    return Object.fromEntries(rows.map((r) => [r.id, Number(r.likes_count)]));
  }
  const store = blobs();
  const { blobs: list } = await store.list();
  const entries = await Promise.all(
    list.map(async ({ key }) => [key, Number((await store.get(key, { type: 'json' }))?.likes_count ?? 0)] as const),
  );
  return Object.fromEntries(entries);
}

export async function incrementLike(track: TrackRecord): Promise<number> {
  if (sql) {
    await ensureSchema();
    const [row] = await sql`
      INSERT INTO tracks (id, title, artist, region, likes_count)
      VALUES (${track.id}, ${track.track}, ${track.artist}, ${track.region}, 1)
      ON CONFLICT (id) DO UPDATE SET likes_count = tracks.likes_count + 1, updated_at = NOW()
      RETURNING likes_count`;
    return Number(row.likes_count);
  }

  // Optimistic concurrency on Blobs: retry until our conditional write wins.
  const store = blobs();
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await store.getWithMetadata(track.id, { type: 'json' });
    const likes_count = Number(current?.data?.likes_count ?? 0) + 1;
    const value = { title: track.track, artist: track.artist, region: track.region, likes_count, updated_at: new Date().toISOString() };
    const { modified } = await store.setJSON(
      track.id,
      value,
      current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
    );
    if (modified) return likes_count;
  }
  throw new Error('like_conflict');
}
