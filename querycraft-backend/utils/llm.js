// utils/llm.js
const axios = require('axios');
const { parseLLMResponseText } = require('../utils/responseParser');

const LLM_ENDPOINT = process.env.LLM_ENDPOINT || 'http://127.0.0.1:11434/api/generate';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'mistral:7b-instruct';

// If you prefer a different env name for Gemini set it here:
const GENAI_KEY = process.env.GENAI_KEY || process.env.GOOGLE_GENAI_KEY || null;

// OpenRouter config
const OPENROUTER_KEY = process.env.OPENROUTER_KEY || null;
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || 'https://localhost';
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || 'QueryCraft';

// Simple whitelist / mapping to avoid arbitrary model strings from client
const MODEL_MAP = {
  'mistral': 'openrouter:mistralai/mistral-7b-instruct:free',
  'mistral:7b-instruct': 'openrouter:mistralai/mistral-7b-instruct:free',
  'mistral:7b': 'openrouter:mistralai/mistral-7b-instruct:free',

  'qwen4': 'qwen:4b',
  'qwen:4b': 'qwen:4b',

  'llama1b': 'llama3.2:1b',
  'llama3.2:1b': 'llama3.2:1b',

  'gemini': 'gemini-2.5-flash',
  'gemini-2.5-flash': 'gemini-2.5-flash',

  'phi3': 'phi3:mini-4k-instruct',
  'phi3-mini': 'phi3:mini-4k-instruct',
  'phi3-mini-4k-instruct': 'phi3:mini-4k-instruct',
  'phi3:mini-4k-instruct': 'phi3:mini-4k-instruct',

  // OpenRouter aliases (you can adjust / add more)
  // Frontend should send one of these keys, not the raw openrouter: string
  'or-deepseek-r1': 'openrouter:deepseek/deepseek-r1',
  'or-qwen2.5-72b-free': 'openrouter:qwen/qwen-2.5-72b-instruct:free',
  'or-grok-code-fast': 'openrouter:x-ai/grok-code-fast-1',
  'or-qwen3-235b-a22b': 'openrouter:qwen/qwen3-235b-a22b:free',
  'or-qwen3-coder': 'openrouter:qwen/qwen3-coder:free',
};

function normalizeModel(input) {
  if (!input) return DEFAULT_MODEL;
  const key = String(input).trim();
  if (MODEL_MAP[key]) return MODEL_MAP[key];
  const lower = key.toLowerCase();
  if (MODEL_MAP[lower]) return MODEL_MAP[lower];
  // unknown model → fall back to default to keep whitelist behaviour
  return DEFAULT_MODEL;
}

// small helper sleep
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// decide whether an error is transient and should be retried
function isTransientGeminiError(err) {
  if (!err) return false;

  // axios-style http status
  const status = err?.response?.status || err?.statusCode || null;
  if (status === 429 || status === 503 || (status >= 500 && status < 600)) return true;

  // some SDKs embed an error code or message
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('overload') || msg.includes('overloaded') || msg.includes('unavailable') || msg.includes('temporarily')) return true;
  if (String(err?.code || '').toUpperCase() === 'ETIMEDOUT' || String(err?.code || '').toUpperCase() === 'ECONNRESET') return true;

  // Google GenAI error shape could include error.status
  if (err?.error?.status === 'UNAVAILABLE' || err?.error?.code === 503) return true;

  return false;
}

/**
 * Query LLM. Priority:
 * 1. If chosen model is Gemini -> use Google GenAI (requires GENAI_KEY).
 * 2. If chosen model is OpenRouter -> call OpenRouter API.
 * 3. Else -> call local endpoint (LLM_ENDPOINT).
 *
 * Returns { text, raw, usage, sql? }
 */
async function queryLLM({ prompt, model = null, max_tokens = 512, temperature = 0.2 }) {
  if (!prompt || !prompt.trim()) throw new Error('Empty prompt');

  const chosenModel = normalizeModel(model);
  const lowerModel = chosenModel.toLowerCase();
  const isGemini = /^gemini/i.test(chosenModel) || lowerModel.includes('gemini');
  const isOpenRouter = chosenModel.startsWith('openrouter:');

  // Helper to try multiple places in the raw response for the "actual" text
  function extractPossibleTextFromRaw(raw) {
    if (raw == null) return '';

    if (typeof raw === 'string') return raw;

    if (typeof raw.text === 'string') return raw.text;
    if (typeof raw.response === 'string') return raw.response;
    if (typeof raw.output === 'string') return raw.output;
    if (typeof raw.result === 'string') return raw.result;

    if (raw.data && typeof raw.data.text === 'string') return raw.data.text;

    if (raw.choices && Array.isArray(raw.choices) && raw.choices.length > 0) {
      const c = raw.choices[0];
      if (c.message && typeof c.message.content === 'string') return c.message.content;
      if (typeof c.text === 'string') return c.text;
      if (c?.message?.content && Array.isArray(c.message.content)) {
        for (const block of c.message.content) {
          if (typeof block === 'string') return block;
          if (block?.text && typeof block.text === 'string') return block.text;
        }
      }
    }

    if (Array.isArray(raw.candidates) && raw.candidates.length > 0) {
      const cand = raw.candidates[0];
      if (typeof cand === 'string') return cand;
      if (cand?.content && typeof cand.content === 'string') return cand.content;
      if (cand?.content && Array.isArray(cand.content)) {
        for (const part of cand.content) {
          if (part?.text) return part.text;
        }
      }
    }

    if (Array.isArray(raw.output) && raw.output.length) {
      try {
        return raw.output.map(o => (typeof o === 'string' ? o : (o?.text || ''))).join('\n');
      } catch (e) {}
    }

    try {
      return JSON.stringify(raw).slice(0, 20000);
    } catch (e) {
      return '';
    }
  }

  // === If chosen model is Gemini -> use Google GenAI ===
  if (isGemini) {
    if (!GENAI_KEY) {
      throw new Error('Gemini model requested but no GENAI_KEY is configured in env.');
    }

    // retry config - tweak via env if you want
    const GEMINI_RETRIES = Number(process.env.GEMINI_RETRIES || 3); // total attempts
    const GEMINI_BASE_DELAY = Number(process.env.GEMINI_BASE_DELAY_MS || 500); // ms
    const GEMINI_MAX_BACKOFF = Number(process.env.GEMINI_MAX_BACKOFF_MS || 5000); // ms

    // dynamic import so package is loaded only when used
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: GENAI_KEY });

    let lastErr = null;
    for (let attempt = 1; attempt <= GEMINI_RETRIES; attempt++) {
      try {
        const resp = await ai.models.generateContent({
          model: chosenModel,
          // Many GenAI SDKs accept 'contents' or 'input'; using 'contents' here.
          contents: prompt,
          temperature,
          maxOutputTokens: max_tokens
        });

        const raw = resp;
        const possible = extractPossibleTextFromRaw(raw);

        const { cleanedText, sql } = parseLLMResponseText(possible, raw);
        const usage = raw?.usage || raw?.metadata || null;

        return { text: cleanedText || possible || '', raw, usage, sql: sql || null };
      } catch (err) {
        lastErr = err;

        // if this is last attempt, break and throw below
        if (attempt >= GEMINI_RETRIES || !isTransientGeminiError(err)) {
          break;
        }

        // exponential backoff with jitter
        const exp = Math.min(GEMINI_BASE_DELAY * Math.pow(2, attempt - 1), GEMINI_MAX_BACKOFF);
        const jitter = Math.floor(Math.random() * Math.max(100, Math.floor(exp * 0.25))); // up to 25% jitter
        const wait = exp + jitter;

        // small console log for visibility in server logs
        try {
          console.warn(
            `Gemini request failed (attempt ${attempt}/${GEMINI_RETRIES}) — retrying in ${wait}ms:`,
            (err?.response?.status || err?.statusCode || err?.message)
          );
        } catch (e) {}

        await sleep(wait);
        // continue to next attempt
      }
    }

    // after retries, throw with the original error attached
    const msg = lastErr?.message || 'Unknown Gemini error';
    const e = new Error(`Gemini (GenAI) request error: ${msg}`);
    e.cause = lastErr;
    throw e;
  }

  // === If chosen model is OpenRouter -> use OpenRouter API ===
  if (isOpenRouter) {
    if (!OPENROUTER_KEY) {
      throw new Error('OpenRouter model requested but no OPENROUTER_KEY is configured in env.');
    }

    // strip the openrouter: prefix before sending to the API
    const openRouterModel = chosenModel.replace(/^openrouter:/, '');

    try {
      const resp = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: openRouterModel,
          max_tokens,
          temperature,
          messages: [
            // You can add a system prompt if you want,
            // but your "prompt" likely already includes instructions.
            { role: 'user', content: prompt },
          ],
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_KEY}`,
            'HTTP-Referer': OPENROUTER_SITE_URL,
            'X-Title': OPENROUTER_APP_NAME,
          },
        }
      );

      const raw = resp.data;
      const possible = extractPossibleTextFromRaw(raw);

      const { cleanedText, sql } = parseLLMResponseText(possible, raw);
      const usage = raw?.usage || null;

      return { text: cleanedText || possible || '', raw, usage, sql: sql || null };
    } catch (err) {
      const msg = err?.response?.data
        ? JSON.stringify(err.response.data).slice(0, 1000)
        : err.message;
      const e = new Error(`OpenRouter API error: ${msg}`);
      e.cause = err;
      throw e;
    }
  }

  // === Otherwise: use local LLM endpoint ===
  if (!LLM_ENDPOINT) {
    throw new Error('No local LLM endpoint configured (set LLM_ENDPOINT).');
  }

  try {
    const payload = {
      model: chosenModel,
      prompt,
      max_tokens,
      temperature,
      stream: false
    };

    const resp = await axios.post(LLM_ENDPOINT, payload, {
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const raw = resp.data;
    const possible = extractPossibleTextFromRaw(raw);

    const { cleanedText, sql } = parseLLMResponseText(possible, raw);

    const usage = raw?.usage || null;
    return { text: cleanedText || possible || '', raw, usage, sql: sql || null };
  } catch (err) {
    const msg = err?.response?.data ? JSON.stringify(err.response.data).slice(0, 1000) : err.message;
    const e = new Error(`LLM endpoint error: ${msg}`);
    e.cause = err;
    throw e;
  }
}

module.exports = { queryLLM };
