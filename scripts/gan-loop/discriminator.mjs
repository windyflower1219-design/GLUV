// Discriminator (Haiku) — adversary.
// Two responsibilities:
//  1) generateAdversarialCases(): produce N new test cases that target weak spots
//     observed in the latest evaluation results.
//  2) analyzeFailures(): summarize WHY the parser failed, in human language,
//     so the Generator (Sonnet) has a good brief to work from.

import { callClaude, MODELS, extractJsonArray, extractJson } from './lib/llm.mjs';

const SYSTEM_DISC = `당신은 한국어 음성 입력 파서를 공격하는 적대적 QA 엔지니어(Discriminator)입니다.
당신의 임무는 음식 + 혈당 + 시간을 추출하는 LLM 파서가 틀리기 쉬운 한국어 발화 케이스를 만들어내는 것입니다.
공격은 가혹하지만 *현실적*이어야 합니다 — 실제 한국 사용자가 말할 법한 표현이어야 합니다.

좋은 공격 카테고리:
- 사투리/구어체 어미 ("먹었드만", "묵었어", "혔어")
- 시간 표현 중의성 ("아까", "조금 전", "어제 저녁부터 오늘 아침")
- 수량 표현 트릭 ("반쪽", "1/2", "한입만", "조금 많이")
- 한글 숫자 ("백이십", "이백오")
- 음식과 혈당 수치 사이 숫자 충돌 ("라면 2개 먹고 200")
- 음식 이름 띄어쓰기 / 신조어 ("마라샹궈", "양념갈비찜")
- 부분 문장, 말줄임 ("그거 했어")
- 감탄사·필러 노이즈 ("아 진짜 오늘 막...")
- 부정문 ("안 먹었어")
- 단위 불일치 (개를 잔으로, 인분을 그릇으로)

각 케이스는 반드시 정답(expected)을 함께 가지고 있어야 합니다.`;

export async function generateAdversarialCases({ round, count, seedCases, lastResults }) {
  const failedSummary = (lastResults || [])
    .filter((r) => (r.score?.composite ?? 1) < 0.7)
    .slice(0, 12)
    .map((r) => `- ${r.caseId} [${r.category}] "${r.input}" → score ${r.score.composite.toFixed(2)}, brk=${JSON.stringify(r.score.breakdown)}`)
    .join('\n') || '(이전 실패 사례 없음 — 첫 라운드)';

  const seedCats = [...new Set((seedCases || []).map((c) => c.category))].join(', ');

  const userMsg = `[Round ${round}] 새로운 적대적 케이스 ${count}개를 만들어주세요.

기존 시드 카테고리: ${seedCats}

이전 라운드에서 파서가 실패한 케이스(있다면 약점):
${failedSummary}

요구사항:
1. 위 실패 패턴을 강화하는 변종을 50% 이상 포함
2. 시드에 없는 새로운 트릭(공격 카테고리)도 30% 이상 포함
3. 각 케이스는 정답을 명확히 알 수 있어야 함 (모호하면 needsClarification: true 로)
4. 응답은 **JSON 배열 only**, 마크다운/설명 없이.

각 항목 스키마:
{
  "id": "rN-NN",
  "category": "string (공격 카테고리)",
  "input": "사용자 음성 발화",
  "expected": {
    "parsedFoods": [{"name": "...", "quantity": 1, "unit": "..."}],
    "glucoseValue": 120,            // 없으면 null
    "detectedMeasType": "random|fasting|postmeal_30m|postmeal_1h|postmeal_2h",
    "detectedTime": "HH:mm" | null,
    "needsClarification": false
  },
  "reasoning": "왜 이게 어려운지 한 줄"
}`;

  const { text } = await callClaude({
    model: MODELS.HAIKU,
    system: SYSTEM_DISC,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: 4096,
  });

  const cases = extractJsonArray(text);
  if (!Array.isArray(cases)) {
    throw new Error('Discriminator did not return a JSON array of cases. Raw:\n' + text.slice(0, 500));
  }
  // Tag with round
  return cases.map((c, i) => ({ ...c, id: c.id || `r${round}-${String(i + 1).padStart(2, '0')}` }));
}

const SYSTEM_ANALYSIS = `당신은 한국어 음성 파서의 실패 패턴을 진단하는 분석가입니다.
주어진 실패 사례들을 *카테고리별*로 묶고, 각 묶음이 프롬프트의 어느 부분(또는 누락된 지침)에서 비롯되는지 짧고 정확하게 설명하세요.`;

export async function analyzeFailures({ round, results }) {
  const failures = results.filter((r) => (r.score?.composite ?? 1) < 0.7);
  if (failures.length === 0) {
    return { summary: '실패 케이스 없음 — 모든 케이스가 0.7 이상.', clusters: [] };
  }
  const payload = failures.map((r) => ({
    id: r.caseId,
    category: r.category,
    input: r.input,
    expected: r.expected,
    actual: r.actual,
    breakdown: r.score.breakdown,
    composite: r.score.composite,
  }));
  const userMsg = `[Round ${round}] 아래는 현재 프롬프트가 실패한 케이스들입니다.
실패를 묶고, 각 클러스터의 근본 원인과 프롬프트 개선 방향(코드가 아니라 자연어 가이드)을 JSON으로 정리해주세요.

실패 데이터(JSON):
${JSON.stringify(payload, null, 2)}

응답 스키마(JSON only):
{
  "summary": "1~2문장 요약",
  "clusters": [
    {
      "name": "클러스터 이름",
      "caseIds": ["rN-NN", ...],
      "rootCause": "근본 원인 (1~2문장)",
      "promptFixDirection": "프롬프트에 어떤 지침/예시를 추가/수정해야 하는지 (1~3문장)"
    }
  ]
}`;
  const { text } = await callClaude({
    model: MODELS.HAIKU,
    system: SYSTEM_ANALYSIS,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: 3072,
  });
  const obj = extractJson(text);
  if (!obj) throw new Error('Failure analysis JSON parse failed. Raw:\n' + text.slice(0, 500));
  return obj;
}
