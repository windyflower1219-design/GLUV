// Thin wrappers around Anthropic + Gemini HTTP APIs so the loop stays dep-light.
// Only uses global fetch (Node 18+). No extra npm installs required.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const MODELS = {
  SONNET: 'claude-sonnet-4-6',
  HAIKU: 'claude-haiku-4-5-20251001',
  GEMINI: 'gemini-2.0-flash',         // SUT (the parser under test)
  GEMINI_PRO: 'gemini-2.5-pro',       // Generator (improves prompt)
  GEMINI_PRO_FALLBACK: 'gemini-1.5-pro',
};

/**
 * Call Anthropic Claude (Sonnet or Haiku).
 * @param {{model: string, system?: string, messages: Array<{role:string, content:string}>, maxTokens?: number}} opts
 */
export async function callClaude({ model, system, messages, maxTokens = 4096 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for the GAN loop (Sonnet + Haiku).');
  }
  const body = {
    model,
    max_tokens: maxTokens,
    messages,
  };
  if (system) body.system = system;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  return { text, usage: data.usage };
}

// Shared throttle: ensure min gap between Gemini calls to stay under per-minute quota.
let _lastCallAt = 0;
async function throttle() {
  const minGapMs = parseInt(process.env.GAN_THROTTLE_MS || '1500', 10);
  const wait = Math.max(0, _lastCallAt + minGapMs - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  _lastCallAt = Date.now();
}

function parseRetryDelayMs(text) {
  // Gemini returns "Please retry in 23.7s" and retryDelay:"23s"
  const m = text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (m) return Math.ceil(parseFloat(m[1]) * 1000);
  const m2 = text.match(/retry in (\d+(?:\.\d+)?)s/);
  if (m2) return Math.ceil(parseFloat(m2[1]) * 1000);
  return 15000;
}

/**
 * Call Gemini (the actual parser under test) with a plain prompt string.
 * Respects GAN_SUT_MODEL env for easy model swap (e.g. gemini-1.5-flash).
 * Throttles and retries on 429.
 */
export async function callGemini({ model, prompt }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required to evaluate the parser.');
  const effModel = model || process.env.GAN_SUT_MODEL || MODELS.GEMINI;
  const maxRetries = parseInt(process.env.GAN_MAX_RETRIES || '3', 10);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    await throttle();
    const url = `${GEMINI_URL}/${effModel}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { text, modelUsed: effModel };
    }
    const txt = await res.text();
    if (res.status === 429 && attempt < maxRetries) {
      const wait = parseRetryDelayMs(txt) + 2000;
      console.warn(`  [throttle] 429 on attempt ${attempt + 1}/${maxRetries + 1}, sleeping ${Math.round(wait / 1000)}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Gemini API ${res.status}: ${txt}`);
  }
  throw new Error('Gemini API: exhausted retries on 429');
}

/**
 * Call Gemini with a system instruction + user message, used for Generator role.
 * Tries GEMINI_PRO first, falls back to GEMINI_PRO_FALLBACK on 404.
 */
export async function callGeminiChat({ model = MODELS.GEMINI_PRO, system, user, maxOutputTokens = 4096 }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required.');
  const maxRetries = parseInt(process.env.GAN_MAX_RETRIES || '3', 10);
  const tryCall = async (m) => {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      await throttle();
      const url = `${GEMINI_URL}/${m}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens },
      };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { text, modelUsed: m };
      }
      const txt = await res.text();
      if (res.status === 429 && attempt < maxRetries) {
        const wait = parseRetryDelayMs(txt) + 2000;
        console.warn(`  [throttle] 429 on ${m} attempt ${attempt + 1}, sleeping ${Math.round(wait / 1000)}s...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      const err = new Error(`Gemini API ${res.status}: ${txt}`);
      err.status = res.status;
      throw err;
    }
    throw new Error(`Gemini API ${m}: exhausted retries on 429`);
  };
  try {
    return await tryCall(model);
  } catch (e) {
    if (e.status === 404 && model !== MODELS.GEMINI_PRO_FALLBACK) {
      console.warn(`[llm] ${model} not available, falling back to ${MODELS.GEMINI_PRO_FALLBACK}`);
      return await tryCall(MODELS.GEMINI_PRO_FALLBACK);
    }
    throw e;
  }
}

/**
 * Extract a JSON object from an LLM response, tolerating ```json fences and stray text.
 */
export function extractJson(text) {
  if (!text) return null;
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/**
 * Extract a JSON array (for lists of test cases).
 */
export function extractJsonArray(text) {
  if (!text) return null;
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1) return null;
  t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
