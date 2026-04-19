// Evaluator: runs the current prompt against the real Gemini parser for each case.
// In --dry-run mode, returns deterministic stub responses so the pipeline can be
// exercised without any network calls.
import { writeFile, rename } from 'node:fs/promises';
import { callGemini, extractJson, MODELS } from './lib/llm.mjs';
import { scoreCase } from './lib/scorer.mjs';

function fillPrompt(template, voiceText) {
  return template.replace('{{VOICE_TEXT}}', voiceText.replace(/"/g, '\\"'));
}

// Atomic write: tmp file → rename. Prevents torn/truncated JSON on Windows.
async function atomicWriteJSON(path, obj) {
  const tmp = path + '.tmp';
  await writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await rename(tmp, path);
}

// Stub parser for --dry-run: VERY naive — exists only so the pipeline scaffolding
// can be validated without API calls. Real evaluation uses Gemini.
function dryRunParse(voiceText) {
  const FOODS = ['비빔밥','된장찌개','짜장면','짬뽕','아메리카노','샌드위치','피자','국밥',
    '치킨','파스타','샐러드','라떼','김밥','햄버거','콜라','떡볶이','삼겹살','맥주',
    '라면','만두','밥','된장국'];
  const parsedFoods = [];
  for (const f of FOODS) {
    if (voiceText.includes(f)) parsedFoods.push({ name: f, quantity: 1, unit: '인분' });
  }
  const gMatch = voiceText.match(/(\d{2,3})/);
  const glucoseValue = gMatch ? parseInt(gMatch[1], 10) : null;
  let detectedMeasType = 'random';
  if (voiceText.includes('공복')) detectedMeasType = 'fasting';
  else if (voiceText.includes('식후 30분') || voiceText.includes('30분')) detectedMeasType = 'postmeal_30m';
  else if (voiceText.includes('식후 2시간') || voiceText.includes('2시간')) detectedMeasType = 'postmeal_2h';
  else if (voiceText.includes('식후') || voiceText.includes('한 시간')) detectedMeasType = 'postmeal_1h';
  let detectedTime = null;
  if (voiceText.includes('아침')) detectedTime = '08:00';
  else if (voiceText.includes('점심')) detectedTime = '12:30';
  else if (voiceText.includes('저녁')) detectedTime = '18:30';
  return { parsedFoods, glucoseValue, detectedMeasType, detectedTime, needsClarification: parsedFoods.length === 0 && glucoseValue === null };
}

export async function evaluatePrompt({ promptTemplate, cases, dryRun = false, onProgress, incrementalPath }) {
  const results = [];
  for (let i = 0; i < cases.length; i += 1) {
    const tc = cases[i];
    let actual = null;
    let rawResponse = '';
    let error = null;
    try {
      if (dryRun) {
        actual = dryRunParse(tc.input);
      } else {
        const filled = fillPrompt(promptTemplate, tc.input);
        const { text } = await callGemini({ prompt: filled });
        rawResponse = text;
        actual = extractJson(text);
        if (!actual) throw new Error('Gemini response not valid JSON');
      }
    } catch (e) {
      error = e.message;
    }
    const score = actual ? scoreCase(actual, tc.expected) : { composite: 0, breakdown: { error: true } };
    results.push({ caseId: tc.id, category: tc.category, input: tc.input, expected: tc.expected, actual, rawResponse, error, score });
    onProgress?.(i + 1, cases.length, tc.id, score.composite);
    // Incremental save after every case so that Ctrl+C / crashes don't lose work.
    // Uses atomic rename so a kill mid-write can only leave the PREVIOUS complete file,
    // never a torn one.
    if (incrementalPath) {
      try { await atomicWriteJSON(incrementalPath, results); } catch {}
    }
  }
  return results;
}
