#!/usr/bin/env node
// list-models.mjs — calls Gemini ListModels to find which models the API key can access.
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDotEnv } from './lib/dotenv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..', '..');

await loadDotEnv(APP_ROOT);
const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!apiKey) { console.error('GEMINI_API_KEY missing'); process.exit(1); }

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`;
const res = await fetch(url);
if (!res.ok) { console.error('HTTP', res.status, await res.text()); process.exit(1); }
const data = await res.json();
const models = (data.models || [])
  .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
  .map((m) => ({
    name: m.name.replace('models/', ''),
    inLimit: m.inputTokenLimit,
    outLimit: m.outputTokenLimit,
  }));
console.log(`Models supporting generateContent (${models.length}):`);
for (const m of models) console.log(`  - ${m.name}  (in=${m.inLimit}, out=${m.outLimit})`);
