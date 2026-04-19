#!/usr/bin/env node
// phase-final.mjs — assemble FINAL.md from all round summaries that exist.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFinalReport } from './lib/report.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const history = [];
  for (let r = 0; r <= 20; r += 1) {
    const sp = resolve(__dirname, 'results', `round-${r}.summary.json`);
    if (!existsSync(sp)) continue;
    const summary = JSON.parse(await readFile(sp, 'utf8'));
    let patchInfo = null;
    const promptPath = resolve(__dirname, 'prompts', `round-${r}.txt`);
    if (existsSync(promptPath)) {
      patchInfo = { changeNotes: [`prompts/round-${r}.txt 적용됨`], promptPath: `prompts/round-${r}.txt` };
    }
    history.push({ round: r, summary, patchInfo });
  }
  await writeFinalReport({ path: resolve(__dirname, 'reports', 'FINAL.md'), history });
  console.log(`✓ FINAL.md (${history.length} rounds)`);
}

main().catch((e) => { console.error('phase-final failed:', e); process.exit(1); });
