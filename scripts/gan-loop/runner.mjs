#!/usr/bin/env node
// GAN Loop Orchestrator — 3 rounds fixed.
//
// Roles:
//   Sonnet (Generator)    — proposes improved prompts based on failure analysis.
//   Haiku  (Discriminator) — generates adversarial cases + analyzes failures.
//   Gemini (Parser)       — the model under attack (current production parser).
//
// Flow:
//   Round 0  : evaluate baseline prompt on seed cases.
//   Round 1  : Haiku generates new adversarial cases → eval current prompt
//              → Haiku analyzes failures → Sonnet proposes new prompt.
//   Round 2,3: same as Round 1 but using updated prompt.
//
// Usage:
//   node scripts/gan-loop/runner.mjs            # 3 rounds, real APIs
//   node scripts/gan-loop/runner.mjs --dry-run  # no APIs, deterministic stub
//   node scripts/gan-loop/runner.mjs --rounds=2
//   node scripts/gan-loop/runner.mjs --new-cases=10

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDotEnv } from './lib/dotenv.mjs';
import { evaluatePrompt } from './evaluator.mjs';
import { summarize } from './lib/scorer.mjs';
import { generateAdversarialCases, analyzeFailures } from './discriminator.mjs';
import { proposeNewPrompt } from './generator.mjs';
import { writeRoundReport, writeFinalReport } from './lib/report.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..', '..');

function parseFlags(argv) {
  const flags = { rounds: 3, newCases: 10, dryRun: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') flags.dryRun = true;
    else if (a.startsWith('--rounds=')) flags.rounds = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--new-cases=')) flags.newCases = parseInt(a.split('=')[1], 10);
  }
  return flags;
}

async function ensureDir(p) { if (!existsSync(p)) await mkdir(p, { recursive: true }); }

async function main() {
  const flags = parseFlags(process.argv);
  await loadDotEnv(APP_ROOT);

  console.log(`\n=== GAN Loop start | rounds=${flags.rounds} new-cases=${flags.newCases} dry-run=${flags.dryRun} ===\n`);

  const baselinePath = resolve(__dirname, 'prompts', 'baseline.txt');
  const statePath = resolve(__dirname, 'state', 'prompt.current.txt');
  const reportsDir = resolve(__dirname, 'reports');
  const resultsDir = resolve(__dirname, 'results');
  const casesDir = resolve(__dirname, 'cases');
  await Promise.all([ensureDir(reportsDir), ensureDir(resultsDir), ensureDir(dirname(statePath))]);

  // Initialize state with baseline if missing
  if (!existsSync(statePath)) {
    const baseline = await readFile(baselinePath, 'utf8');
    await writeFile(statePath, baseline, 'utf8');
  }

  let currentPrompt = await readFile(statePath, 'utf8');
  const seedCases = JSON.parse(await readFile(resolve(casesDir, 'seed.json'), 'utf8'));

  const history = [];
  let cumulativeCases = [...seedCases];
  let lastResults = null;

  // ---------- ROUND 0: baseline ----------
  {
    console.log(`▶ Round 0 (baseline) — evaluating ${seedCases.length} seed cases...`);
    const results = await evaluatePrompt({
      promptTemplate: currentPrompt,
      cases: seedCases,
      dryRun: flags.dryRun,
      onProgress: (i, n, id, s) => console.log(`  [${i}/${n}] ${id} score=${s.toFixed(2)}`),
    });
    const summary = summarize(results);
    await writeFile(resolve(resultsDir, `round-0.json`), JSON.stringify(results, null, 2), 'utf8');
    await writeRoundReport({
      path: resolve(reportsDir, 'round-0.md'),
      round: 0,
      summary,
      results,
      attackInfo: { generatedCount: 0, seedCount: seedCases.length, totalCount: seedCases.length, categories: [...new Set(seedCases.map(c => c.category))] },
    });
    history.push({ round: 0, summary });
    lastResults = results;
    console.log(`  ✓ Round 0 composite=${summary.composite.toFixed(3)} (pass ${summary.pass}/${summary.n})\n`);
  }

  // ---------- ROUNDS 1..N ----------
  for (let round = 1; round <= flags.rounds; round += 1) {
    console.log(`▶ Round ${round} — Haiku generating adversarial cases...`);
    let newCases;
    if (flags.dryRun) {
      // Deterministic stub: variations of seed cases
      newCases = seedCases.slice(0, flags.newCases).map((c, i) => ({
        ...c,
        id: `r${round}-${String(i + 1).padStart(2, '0')}`,
        category: `${c.category}-stub`,
        input: c.input + ' (라운드' + round + ')',
      }));
    } else {
      newCases = await generateAdversarialCases({ round, count: flags.newCases, seedCases, lastResults });
    }
    await writeFile(resolve(casesDir, `round-${round}.json`), JSON.stringify(newCases, null, 2), 'utf8');
    cumulativeCases = [...cumulativeCases, ...newCases];

    console.log(`  Evaluating ${newCases.length} new cases on current prompt...`);
    const results = await evaluatePrompt({
      promptTemplate: currentPrompt,
      cases: newCases,
      dryRun: flags.dryRun,
      onProgress: (i, n, id, s) => console.log(`  [${i}/${n}] ${id} score=${s.toFixed(2)}`),
    });
    const summary = summarize(results);
    await writeFile(resolve(resultsDir, `round-${round}.json`), JSON.stringify(results, null, 2), 'utf8');

    console.log(`  Haiku analyzing failures...`);
    let analysis = { summary: '(dry-run skipped)', clusters: [] };
    if (!flags.dryRun) {
      analysis = await analyzeFailures({ round, results });
    }

    console.log(`  Sonnet proposing new prompt...`);
    let patchInfo = null;
    if (!flags.dryRun) {
      const proposal = await proposeNewPrompt({ round, currentPrompt, analysis, lastSummary: summary });
      currentPrompt = proposal.newPrompt;
      const promptPath = resolve(__dirname, 'prompts', `round-${round}.txt`);
      await writeFile(promptPath, currentPrompt, 'utf8');
      await writeFile(statePath, currentPrompt, 'utf8');
      patchInfo = { changeNotes: proposal.changeNotes, promptPath };
    } else {
      patchInfo = { changeNotes: ['(dry-run) no patch applied'], promptPath: '(none)' };
    }

    await writeRoundReport({
      path: resolve(reportsDir, `round-${round}.md`),
      round,
      summary,
      results,
      attackInfo: {
        generatedCount: newCases.length,
        seedCount: 0,
        totalCount: newCases.length,
        categories: [...new Set(newCases.map((c) => c.category))],
      },
      analysis,
      patchInfo,
    });

    history.push({ round, summary, patchInfo });
    lastResults = results;
    console.log(`  ✓ Round ${round} composite=${summary.composite.toFixed(3)} (pass ${summary.pass}/${summary.n})\n`);
  }

  // ---------- FINAL ----------
  await writeFinalReport({ path: resolve(reportsDir, 'FINAL.md'), history });
  console.log(`✓ Done. Reports → scripts/gan-loop/reports/`);
  console.log(`  Final prompt    → scripts/gan-loop/state/prompt.current.txt`);
  console.log(`  Apply to app    → node scripts/gan-loop/apply-prompt.mjs (수동 검토 후)`);
}

main().catch((e) => {
  console.error('\n✗ GAN loop failed:', e?.stack || e?.message || e);
  process.exit(1);
});
