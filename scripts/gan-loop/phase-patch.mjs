#!/usr/bin/env node
// phase-patch.mjs — coop-mode generator phase.
// Reads analysis/round-N.json (Discriminator's failure analysis) and the
// current prompt, asks Gemini 2.5 Pro for a new prompt, writes:
//   prompts/round-N.txt
//   state/prompt.current.txt   (overwritten — becomes new active prompt)
//   reports/round-N.md
//
// Usage:
//   node scripts/gan-loop/phase-patch.mjs --round=1

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDotEnv } from './lib/dotenv.mjs';
import { callGeminiChat, MODELS, extractJson } from './lib/llm.mjs';
import { writeRoundReport } from './lib/report.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..', '..');

function getRound() {
  const arg = process.argv.find((a) => a.startsWith('--round='));
  if (!arg) throw new Error('--round=N is required');
  return parseInt(arg.split('=')[1], 10);
}

const SYSTEM_GEN = `당신은 한국어 음성→구조화 JSON 파서를 위한 시니어 프롬프트 엔지니어입니다.
대상 파서는 Gemini 2.0 Flash이고, 당신은 Gemini 2.5 Pro로서 같은 모델 계열의 행동 특성을 잘 이해합니다.

규칙:
- 출력 JSON 스키마(필드명·타입)는 절대 변경 금지: parsedFoods[], glucoseValue, detectedMeasType, detectedTime, needsClarification, clarificationQuestion.
- {{VOICE_TEXT}} placeholder는 그대로 유지.
- 한국어로 명확히. 모호한 케이스의 처리 규칙·few-shot 예시·반례를 구체적으로 추가.
- 환각(없는 음식·혈당값 만들기) 방지 가드레일을 포함.
- 분량은 baseline의 2배 이내.

응답은 반드시 JSON only:
{"changeNotes": ["바뀐 부분 한 줄씩"], "newPrompt": "전체 프롬프트 raw 텍스트"}`;

async function main() {
  await loadDotEnv(APP_ROOT);
  const round = getRound();

  const statePath = resolve(__dirname, 'state', 'prompt.current.txt');
  const analysisPath = resolve(__dirname, 'analysis', `round-${round}.json`);
  const summaryPath = resolve(__dirname, 'results', `round-${round}.summary.json`);
  const resultsPath = resolve(__dirname, 'results', `round-${round}.json`);

  for (const p of [statePath, analysisPath, summaryPath, resultsPath]) {
    if (!existsSync(p)) throw new Error(`Required file missing: ${p}`);
  }

  const currentPrompt = await readFile(statePath, 'utf8');
  const analysis = JSON.parse(await readFile(analysisPath, 'utf8'));
  const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
  const results = JSON.parse(await readFile(resultsPath, 'utf8'));

  console.log(`[phase-patch] round=${round} — calling Gemini Generator (${MODELS.GEMINI_PRO})...`);
  const userMsg = `[Round ${round}] 현재 프롬프트와 실패 분석을 받아 *개선된 프롬프트* 한 본을 만들어주세요.

[현재 프롬프트]
\`\`\`
${currentPrompt}
\`\`\`

[직전 평가 요약]
${JSON.stringify(summary, null, 2)}

[실패 분석 (Discriminator: Claude Opus)]
${JSON.stringify(analysis, null, 2)}

각 클러스터에 대응하는 명시적 규칙 또는 1줄 few-shot 예시를 새 프롬프트에 추가하세요.
JSON 출력 스키마와 {{VOICE_TEXT}} placeholder는 절대 변경 금지.`;

  const { text, modelUsed } = await callGeminiChat({
    model: MODELS.GEMINI_PRO,
    system: SYSTEM_GEN,
    user: userMsg,
    maxOutputTokens: 4096,
  });
  const obj = extractJson(text);
  if (!obj || typeof obj.newPrompt !== 'string') {
    console.error('--- Generator raw response ---\n' + text.slice(0, 2000));
    throw new Error('Generator did not return valid {changeNotes, newPrompt} JSON.');
  }
  if (!obj.newPrompt.includes('{{VOICE_TEXT}}')) {
    throw new Error('Generator output missing {{VOICE_TEXT}} placeholder — refusing to apply.');
  }

  const promptsDir = resolve(__dirname, 'prompts');
  const reportsDir = resolve(__dirname, 'reports');
  await mkdir(promptsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });

  const newPromptPath = resolve(promptsDir, `round-${round}.txt`);
  await writeFile(newPromptPath, obj.newPrompt, 'utf8');
  await writeFile(statePath, obj.newPrompt, 'utf8');

  const cases = JSON.parse(await readFile(resolve(__dirname, 'cases', `round-${round}.json`), 'utf8'));

  await writeRoundReport({
    path: resolve(reportsDir, `round-${round}.md`),
    round,
    summary,
    results,
    attackInfo: {
      generatedCount: cases.length,
      seedCount: 0,
      totalCount: cases.length,
      categories: [...new Set(cases.map((c) => c.category))],
    },
    analysis,
    patchInfo: {
      changeNotes: [`(by ${modelUsed})`, ...(obj.changeNotes || [])],
      promptPath: `prompts/round-${round}.txt`,
    },
  });

  console.log(`[phase-patch] ✓ new prompt → ${newPromptPath}`);
  console.log(`[phase-patch] ✓ state    → ${statePath}`);
  console.log(`[phase-patch] ✓ report   → reports/round-${round}.md`);
  console.log(`[phase-patch] changeNotes:`);
  for (const n of obj.changeNotes || []) console.log(`  - ${n}`);
}

main().catch((e) => { console.error('phase-patch failed:', e?.message || e); process.exit(1); });
