// Thin Gemini REST client with Google Search grounding, JSON mode, retries and model fallback.
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];

let activeModel = null;
const missingModels = new Set();

function candidateModels() {
  const preferred = process.env.AI_MODEL?.replace(/^models\//, '');
  return [...new Set([activeModel, preferred, ...FALLBACK_MODELS])].filter((m) => m && !missingModels.has(m));
}

async function call(model, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const err = await res.json().catch(() => ({}));
    const quotaExhausted = res.status === 429 && /quota/i.test(err.error?.message ?? '');
    const retriable = (res.status === 429 && !quotaExhausted) || res.status >= 500;
    if (retriable && attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    const e = new Error(`Gemini ${model} ${res.status}: ${err.error?.message ?? res.statusText}`);
    e.status = res.status;
    throw e;
  }
}

/**
 * @param {{ system?: string, prompt: string, search?: boolean, schema?: object, temperature?: number }} opts
 * @returns {Promise<{ text: string, sources: {title: string, uri: string}[], model: string }>}
 */
export async function generate({ system, prompt, search = false, schema, temperature = 0.4 }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      ...(schema && { responseMimeType: 'application/json', responseSchema: schema }),
    },
    ...(system && { systemInstruction: { parts: [{ text: system }] } }),
    ...(search && { tools: [{ google_search: {} }] }),
  };

  let lastError;
  for (const model of candidateModels()) {
    try {
      const data = await call(model, body);
      if (activeModel !== model) {
        if (process.env.AI_MODEL && model !== process.env.AI_MODEL) {
          console.warn(`⚠ AI_MODEL "${process.env.AI_MODEL}" unavailable, using "${model}" instead.`);
        }
        activeModel = model;
      }
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
      if (!text) throw new Error(`Empty response from ${model} (finishReason: ${cand?.finishReason})`);
      const sources = (cand?.groundingMetadata?.groundingChunks ?? [])
        .map((c) => c.web)
        .filter(Boolean)
        .map(({ title, uri }) => ({ title, uri }));
      return { text, sources, model };
    } catch (e) {
      lastError = e;
      // fall through to the next model on unknown/unsupported model, overload or exhausted quota
      if (![400, 404, 429, 503].includes(e.status)) throw e;
      if (e.status === 404) missingModels.add(model);
      console.warn(`⚠ ${e.message.slice(0, 120)} — trying next model`);
    }
  }
  throw lastError;
}

/** Extracts the first JSON value from a model reply (handles ```json fences and surrounding prose). */
export function parseJsonLoose(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.search(/[[{]/);
    const end = Math.max(raw.lastIndexOf(']'), raw.lastIndexOf('}'));
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error(`Model did not return JSON:\n${text.slice(0, 500)}`);
  }
}
