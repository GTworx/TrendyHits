// POST /api/subscribe   body: { email, language }  ->  { success }
import type { Config } from '@netlify/functions';
import { baseTagId, kit, languageTagId } from '../../shared/kit.mjs';

export default async (req: Request) => {
  const { email, language } = await req.json().catch(() => ({}));
  const lang = language === 'en' ? 'en' : 'tr';

  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ success: false, error: 'invalid_email' }, { status: 400 });
  }

  try {
    // 1) Create the subscriber (Kit upserts if the email already exists)
    await kit('/subscribers', { method: 'POST', body: { email_address: email } });

    // 2) Tag with the language tag ("TrendyHits TR" / "TrendyHits EN") and the base tag
    const tagIds = [await languageTagId(lang), await baseTagId()].filter(Boolean);
    for (const tagId of new Set(tagIds)) {
      await kit(`/tags/${tagId}/subscribers`, { method: 'POST', body: { email_address: email } });
    }

    return Response.json({ success: true });
  } catch (error) {
    // Messages shown to users come from the frontend dictionaries, not from here
    console.error('subscribe failed', error);
    return Response.json({ success: false, error: 'subscribe_failed' }, { status: 502 });
  }
};

export const config: Config = { path: '/api/subscribe', method: 'POST' };
