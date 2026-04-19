#!/usr/bin/env node
// phase-eval.mjs — coop-mode evaluator phase.
// Reads cases/round-N.json (provided by the human/Claude Discriminator),
// runs the current prompt through Gemini SUT for each case,
// writes results/round-N.json + a brief summary print.
//
// Usage:
//   node scripts/gan-loop/phase-eval.mjs --round=1
//   node scripts/gan-loop/phase-eval.mjs --round=0           # baseline (uses cases/seed.json)

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDotEnv } from './lib/dotenv.mjs';
import { evaluatePrompt } from './evaluator.mjs';
import { summarize } from './lib/scorer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..', '..');

function getRound() {
  const arg = process.argv.find((a) => a.startsWith('--round='));
  if (!arg) throw new Error('--round=N is required');
  return parseInt(arg.split('=')[1], 10);
}

async function main() {
  await loadDotEnv(APP_ROOT);
  const round = getRound();

  const statePath = resolve(__dirname, 'state', 'prompt.current.txt');
  if (!existsSync(statePath)) {
    const baseline = await readFile(resolve(__dirname, 'prompts', 'baseline.txt'), 'utf8');
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(statePath, baseline, 'utf8');
  }
  const promptTemplate = await readFile(statePath, 'utf8');

  const casesPath = round === 0
    ? resolve(__dirname, 'cases', 'seed.json')
    : resolve(__dirname, 'cases', `round-${round}.json`);
  if (!existsSync(casesPath)) throw new Error(`Cases file missing: ${casesPath}`);
  const cases = JSON.parse(await readFile(casesPath, 'utf8'));

  console.log(`[phase-eval] round=${round} cases=${cases.length}  model=${process.env.GAN_SUT_MODEL || 'gemini-2.0-flash'}  throttle=${process.env.GAN_THROTTLE_MS || '1500'}ms`);
  const resultsDir = resolve(__dirname, 'results');
  await mkdir(resultsDir, { recursive: true });
  const incPath = resolve(resultsDir, `round-${round}.json`);

  const results = await evaluatePrompt({
    promptTemplate,
    cases,
    dryRun: false,
    incrementalPath: incPath,
    onProgress: (i, n, id, s) => {
      const mark = s >= 0.7 ? '✓' : (s > 0 ? '△' : '✗');
      console.log(`  [${i}/${n}] ${mark} ${id} score=${s.toFixed(2)}`);
    },
  });
  const summary = summarize(results);
  // Atomic writes (tmp file → rename) so the final round-N.json can never be torn,
  // even if it overlaps with the per-case incremental save in evaluator.mjs.
  const writeAtomic = async (path, obj) => {
    const tmp = path + '.tmp';
    await writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
    await rename(tmp, path);
  };
  await writeAtomic(incPath, results);
  await writeAtomic(resolve(resultsDir, `round-${round}.summary.json`), summary);

  console.log(`\n[phase-eval] composite=${summary.composite.toFixed(3)} pass=${summary.pass}/${summary.n}`);
  const fails = results.filter((r) => (r.score?.composite ?? 1) < 0.7);
  console.log(`[phase-eval] failed cases (${fails.length}):`);
  for (const f of fails) {
    console.log(`  - ${f.caseId} [${f.category}] score=${f.score.composite.toFixed(2)}  "${f.input.slice(0, 60)}"`);
  }
  console.log(`\n[phase-eval] Results JSON → results/round-${round}.json`);
  console.log(`[phase-eval] Next: write analysis to analysis/round-${round}.json then run phase-patch.`);
}

main().catch((e) => { console.error('phase-eval failed:', e); process.exit(1); });
