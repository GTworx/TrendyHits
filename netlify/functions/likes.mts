// GET /api/likes  ->  { [trackId]: number }
import type { Config } from '@netlify/functions';
import { getAllLikes } from '../lib/likes-store.mts';

export default async () => {
  try {
    return Response.json(await getAllLikes(), {
      headers: { 'Cache-Control': 'public, max-age=30' },
    });
  } catch (error) {
    console.error('likes failed', error);
    return Response.json({ error: 'likes_unavailable' }, { status: 500 });
  }
};

export const config: Config = { path: '/api/likes', method: 'GET' };
