#!/usr/bin/env node
// apply-prompt.mjs — take state/prompt.current.txt and splice it into
// src/app/api/parse-meal/route.ts, replacing the current prompt template.
//
// SAFETY:
//  - Creates a .bak backup before writing.
//  - Bails out if no match is found (tampered file, format drift, etc).
//  - Requires --force to overwrite an existing .bak.
//
// Usage:
//   node scripts/gan-loop/apply-prompt.mjs
//   node scripts/gan-loop/apply-prompt.mjs --force

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..', '..');
const ROUTE = resolve(APP_ROOT, 'src', 'app', 'api', 'parse-meal', 'route.ts');
const PROMPT_FILE = resolve(__dirname, 'state', 'prompt.current.txt');

const force = process.argv.includes('--force');

async function main() {
  if (!existsSync(PROMPT_FILE)) {
    throw new Error(`No current prompt at ${PROMPT_FILE}. Run runner.mjs first.`);
  }
  const newPromptTemplate = (await readFile(PROMPT_FILE, 'utf8')).trim();
  if (!newPromptTemplate.includes('{{VOICE_TEXT}}')) {
    throw new Error('New prompt missing {{VOICE_TEXT}} placeholder — refusing to apply.');
  }
  const routeSrc = await readFile(ROUTE, 'utf8');

  // Match `const prompt = \` ... \`;` block.
  const re = /const\s+prompt\s*=\s*`([\s\S]*?)`\s*;/m;
  const m = routeSrc.match(re);
  if (!m) {
    throw new Error('Could not find `const prompt = `...`;` block in route.ts — cannot apply safely.');
  }

  // Convert {{VOICE_TEXT}} placeholder to ${voiceText} template literal interpolation.
  const injected = newPromptTemplate.replace(/\{\{VOICE_TEXT\}\}/g, '${voiceText}');

  const bakPath = ROUTE + '.bak';
  if (existsSync(bakPath) && !force) {
    throw new Error(`${bakPath} exists. Re-run with --force to overwrite backup.`);
  }
  await copyFile(ROUTE, bakPath);

  const updated = routeSrc.replace(re, 'const prompt = `\n      ' + injected.replace(/`/g, '\\`') + '\n    `;');
  await writeFile(ROUTE, updated, 'utf8');

  console.log(`✓ Applied updated prompt to ${ROUTE}`);
  console.log(`  Backup saved to ${bakPath}`);
  console.log(`  Rollback: mv "${bakPath}" "${ROUTE}"`);
}

main().catch((e) => {
  console.error('✗ apply-prompt failed:', e.message);
  process.exit(1);
});
