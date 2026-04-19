// Generator (Sonnet) — defender / improver.
// Given the current prompt + failure analysis, produces the next prompt version.

import { callClaude, MODELS, extractJson } from './lib/llm.mjs';

const SYSTEM_GEN = `당신은 한국어 음성→구조화 파서의 프롬프트를 개선하는 시니어 프롬프트 엔지니어(Generator)입니다.
- 출력 스키마(JSON 필드명/타입)는 **절대 바꾸지 마세요**. 앱 코드가 의존합니다.
- {{VOICE_TEXT}} placeholder는 그대로 유지하세요.
- 한국어로 명확히 작성하고, 모호한 케이스 처리 규칙·예시·반례(Negative)를 구체적으로 추가하세요.
- 분량은 합리적으로 — baseline의 2배를 넘지 마세요.`;

export async function proposeNewPrompt({ round, currentPrompt, analysis, lastSummary }) {
  const userMsg = `[Round ${round}] 현재 프롬프트와 실패 분석을 바탕으로 *개선된 프롬프트* 한 본을 작성해주세요.

[현재 프롬프트]
\`\`\`
${currentPrompt}
\`\`\`

[직전 평가 요약]
${JSON.stringify(lastSummary, null, 2)}

[실패 분석 (Discriminator)]
${JSON.stringify(analysis, null, 2)}

요구사항:
1. JSON 출력 스키마(필드명/타입)는 변경 금지. needsClarification, clarificationQuestion, parsedFoods, glucoseValue, detectedMeasType, detectedTime 모두 유지.
2. {{VOICE_TEXT}} placeholder는 그대로.
3. 실패 클러스터마다 명시적인 처리 규칙 또는 예시(Few-shot 1줄)를 추가.
4. 영양 수치는 추정이지만 합리적 범위 내로 유지하라는 가드레일 포함.
5. 환각(없는 음식·혈당 만들기) 방지 지침 추가.

응답 스키마(JSON only):
{
  "changeNotes": ["바뀐 부분과 그 이유 한 줄씩"],
  "newPrompt": "전체 프롬프트 텍스트 (raw, 그대로 사용 가능해야 함)"
}`;

  const { text } = await callClaude({
    model: MODELS.SONNET,
    system: SYSTEM_GEN,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: 4096,
  });
  const obj = extractJson(text);
  if (!obj || typeof obj.newPrompt !== 'string') {
    throw new Error('Generator did not return valid {changeNotes,newPrompt}. Raw:\n' + text.slice(0, 500));
  }
  // Safety: must contain placeholder
  if (!obj.newPrompt.includes('{{VOICE_TEXT}}')) {
    throw new Error('Generator output missing {{VOICE_TEXT}} placeholder — refusing to apply.');
  }
  return obj;
}
