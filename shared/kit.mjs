// Minimal Kit (kit.com) API v4 client shared by Netlify Functions and the newsletter agent.
const KIT_API = 'https://api.kit.com/v4';

/**
 * @param {string} path
 * @param {{ method?: string, body?: object, apiKey?: string }} [opts]
 */
export async function kit(path, { method = 'GET', body, apiKey = process.env.KIT_API_KEY } = {}) {
  if (!apiKey) throw new Error('KIT_API_KEY is not set');
  const res = await fetch(`${KIT_API}${path}`, {
    method,
    headers: {
      'X-Kit-Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.errors?.join(', ') || `${res.status} ${res.statusText}`);
  return data;
}

const tagCache = new Map();

/** Resolves a tag to its numeric ID. Accepts an ID or a name; creates the tag by name if missing. */
export async function resolveTagId(nameOrId) {
  if (!nameOrId) return null;
  if (/^\d+$/.test(String(nameOrId))) return Number(nameOrId);
  if (tagCache.has(nameOrId)) return tagCache.get(nameOrId);

  let after = '';
  do {
    const page = await kit(`/tags?per_page=1000${after ? `&after=${after}` : ''}`);
    const hit = page.tags?.find((t) => t.name.toLowerCase() === String(nameOrId).toLowerCase());
    if (hit) {
      tagCache.set(nameOrId, hit.id);
      return hit.id;
    }
    after = page.pagination?.has_next_page ? page.pagination.end_cursor : '';
  } while (after);

  const created = await kit('/tags', { method: 'POST', body: { name: nameOrId } });
  tagCache.set(nameOrId, created.tag.id);
  return created.tag.id;
}

const baseTag = () => process.env.KIT_TAG || 'TrendyHits';

/** Language tag ID: KIT_TAG_ID_TR / KIT_TAG_ID_EN if set, otherwise "<KIT_TAG> TR" / "<KIT_TAG> EN" by name. */
export function languageTagId(lang) {
  const env = lang === 'en' ? process.env.KIT_TAG_ID_EN : process.env.KIT_TAG_ID_TR;
  return resolveTagId(env || `${baseTag()} ${lang.toUpperCase()}`);
}

export function baseTagId() {
  return resolveTagId(baseTag());
}
