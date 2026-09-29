// POST /api/like   body: { id }  ->  { id, likes_count }
import type { Config } from '@netlify/functions';
import { getTracks } from '../lib/trends.mts';
import { incrementLike } from '../lib/likes-store.mts';

export default async (req: Request) => {
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== 'string' || id.length > 128) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }

  // Only tracks in the current trends.json can be liked; title/artist come from the data, not the client
  const track = (await getTracks(new URL(req.url).origin)).get(id);
  if (!track) return Response.json({ error: 'unknown_track' }, { status: 400 });

  try {
    const likes_count = await incrementLike(track);
    return Response.json({ id: track.id, likes_count });
  } catch (error) {
    console.error('like failed', error);
    return Response.json({ error: 'like_failed' }, { status: 500 });
  }
};

export const config: Config = { path: '/api/like', method: 'POST' };
