// GLUV parse-meal API — 2026-04-23 hardening
// 이전 버전 치명적 버그 수정:
//   1) TS 파일 전체에 섞여있던 역슬래시+느낌표 → 느낌표 (SyntaxError로 라우트 자체가 죽어있었음)
//   2) Gemini 응답에 responseMimeType='application/json' 강제 → 마크다운/부연설명 제거
//   3) _diagnostics를 클라이언트에 그대로 노출해 실패 이유 UI에서 표시 가능
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// 모델 체인: primary(JSON mode 지원 Gemini) → fallback(JSON mode 미지원 Gemma는 prompt-only)
const MODEL_CHAIN: string[] = [
  process.env.GEMINI_MODEL_PRIMARY || 'gemini-2.5-flash',
  process.env.GEMINI_MODEL_FALLBACK || 'gemini-2.0-flash',
  'gemma-3-27b-it',
];

// Gemini 구조화 출력 스키마. SDK v0.24+에서 지원.
const RESPONSE_SCHEMA: any = {
  type: SchemaType.OBJECT,
  properties: {
    parsedFoods: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          unit: { type: SchemaType.STRING },
          carbs: { type: SchemaType.NUMBER },
          calories: { type: SchemaType.NUMBER },
          glycemicIndex: { type: SchemaType.NUMBER },
          protein: { type: SchemaType.NUMBER },
          fat: { type: SchemaType.NUMBER },
          sodium: { type: SchemaType.NUMBER },
        },
        required: ['name', 'quantity', 'unit', 'carbs', 'calories', 'glycemicIndex', 'protein', 'fat', 'sodium'],
      },
    },
    glucoseValue: { type: SchemaType.NUMBER, nullable: true },
    detectedMeasType: { type: SchemaType.STRING, nullable: true },
    detectedTime: { type: SchemaType.STRING, nullable: true },
    needsClarification: { type: SchemaType.BOOLEAN },
    clarificationQuestion: { type: SchemaType.STRING, nullable: true },
    topCandidates: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
          reason: { type: SchemaType.STRING, nullable: true },
        },
        required: ['name', 'confidence'],
      },
    },
  },
  required: ['parsedFoods', 'needsClarification'],
};

type ParsedFoodRaw = {
  name?: string;
  quantity?: number;
  unit?: string;
  carbs?: number | null;
  calories?: number | null;
  glycemicIndex?: number | null;
  protein?: number | null;
  fat?: number | null;
  sodium?: number | null;
};

type ParsedResponse = {
  parsedFoods?: ParsedFoodRaw[];
  glucoseValue?: number | null;
  detectedMeasType?: string | null;
  detectedTime?: string | null;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  topCandidates?: Array<{ name?: string; confidence?: number; reason?: string }>;
};

function tryParseJson(raw: string): ParsedResponse | null {
  if (!raw) return null;
  let text = raw.trim();
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null;
  let sliced = text.slice(jsonStart, jsonEnd + 1);
  sliced = sliced.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(sliced) as ParsedResponse;
  } catch {
    return null;
  }
}

function buildMainPrompt(voiceText: string): string {
  return [
    '너는 한국 식단/혈당 기록 앱의 음성 입력 파서다. 아래 문장에서 음식 정보, 혈당 수치, 측정 시점을 최대한 적극적으로 추출해라.',
    '',
    '입력: "' + voiceText + '"',
    '',
    '[출력 규칙]',
    '- JSON만. 마크다운·설명 금지.',
    '- parsedFoods 각 항목은 name/quantity/unit/carbs/calories/glycemicIndex/protein/fat/sodium 9개 필드 모두 숫자 또는 문자열로 채운다. null 금지.',
    '- glucoseValue/detectedMeasType/detectedTime/clarificationQuestion/topCandidates는 해당 없으면 생략 또는 null.',
    '',
    '[A] 음식 인식 resilience — 가장 중요:',
    '    - 사용자가 음식/음료/간식/과일/밥/국/찌개/탕 등을 언급했다면 무조건 parsedFoods에 넣는다.',
    '    - 네가 모르는 메뉴여도 OK. 재료 수식어로 카테고리 유추 후 가장 유사한 한식의 표준 영양값으로 best-estimate 채워라.',
    '    - 띄어쓰기/받침 변이는 표준형으로 normalize해서 name에 기입.',
    '      · 예: "돼지고기짜글이" → "돼지고기 짜글이"',
    '      · 예: "황제해장국" → "황태 해장국" (된소리·유사발음 복원)',
    '      · 예: "북어해장국" → "황태 해장국" (동의 어종 통합)',
    '',
    '[B] Best-estimate 영양값 가이드 (1인분 기준):',
    '    - 짜글이/고추장 찌개류: carbs 15-20, kcal 300-400, GI 50, protein 18-25, fat 15-22, sodium 1100-1400',
    '    - 해장국류(뼈/콩나물/황태/북어): carbs 15-25, kcal 280-520, GI 45-55, protein 18-32, fat 8-22, sodium 1000-1400',
    '    - 국밥류(돼지/순대/콩나물): carbs 55-70, kcal 450-600, GI 60-70, protein 25-30, fat 15-25, sodium 1300-1600',
    '    - 구이/볶음(제육/불고기/삼겹살): carbs 0-20, kcal 320-450, GI 0-55, protein 22-30, fat 15-38, sodium 400-900',
    '    - 면류(라면/짜장/짬뽕/우동/칼국수): carbs 70-85, kcal 420-680, GI 70-80, protein 10-22, fat 4-22, sodium 1500-2500',
    '    - 밥류(흰밥/현미밥/볶음밥/비빔밥): carbs 58-85, kcal 280-580, GI 55-72, protein 5-18, fat 1-18, sodium 3-900',
    '',
    '[C] 수량/단위:',
    '    - "반"=0.5, "한"=1, "두"=2, "세"=3. "한 줄 반"=1.5. "삼분의 일"=0.33, "사분의 일"=0.25.',
    '    - 어림말: "조금/살짝"=0.3, "많이/배불리"=1.5, "실컷/엄청"=2.',
    '    - 단위 기본: 라면→봉지, 김밥→줄, 피자→조각, 치킨→마리, 만두→개, 캔음료→캔, 커피/차→잔, 햄버거→개, 국물요리→그릇, 기타→인분.',
    '',
    '[D] 혈당 수치: "혈당 120", "120 나왔어", "수치가 150" → 정수. 한글숫자도 아라비아로. 없으면 null.',
    '',
    '[E] 부정 필터 — 보수적: "음식명" 직후(어절 2개 이내)에 "안 먹/못 먹/굶/거르/패스" 있으면 제외. 단독 "안"은 부정 아님(안방/안쪽 오탐 금지).',
    '',
    '[F] detectedMeasType: 공복→fasting, "식후 30분"→postmeal_30m, "식후 1시간"/"식후"→postmeal_1h, "식후 2시간"/"한참 뒤"→postmeal_2h, 그 외→random.',
    '',
    '[G] detectedTime: "새벽 3시"=03:00, 아침=08:00, 점심/정오=12:30, 저녁=18:30, 밤=22:00. 없으면 null.',
    '',
    '[H] needsClarification: 음식도 혈당도 전혀 없고 지시대명사만 있을 때만 true. 하나라도 인식되면 false.',
    '',
    '[I] topCandidates: 확신 70% 미만이거나 ASR 오인식 가능성 있을 때 최대 3개 대안을 confidence 내림차순. 자신있으면 빈 배열.',
    '',
    '지금 입력을 파싱해서 JSON만 반환해라.',
  ].join('\n');
}

function buildRecoveryPrompt(voiceText: string): string {
  return [
    '다음 문장에서 음식/음료/간식을 모두 찾아서, 각 항목의 1인분 표준 영양값을 best-estimate해라.',
    '처음 들어본 메뉴여도 네가 아는 가장 유사한 한식 카테고리로 추정해. null 금지.',
    '',
    '문장: "' + voiceText + '"',
    '',
    'JSON만 출력하고 parsedFoods 각 항목에 name, quantity, unit, carbs, calories, glycemicIndex, protein, fat, sodium 모두 포함. 음식이 정말 하나도 없을 때만 parsedFoods: [].',
  ].join('\n');
}

function supportsJsonMode(modelName: string): boolean {
  return /^gemini-/i.test(modelName);
}

async function callModel(apiKey: string, modelName: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const useJson = supportsJsonMode(modelName);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: useJson
      ? {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
        }
      : { temperature: 0.2 },
  });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function generateWithFallback(
  apiKey: string,
  prompt: string,
): Promise<{ data: ParsedResponse | null; modelUsed: string | null; attempts: Array<{ model: string; error?: string }> }> {
  const attempts: Array<{ model: string; error?: string }> = [];
  for (const modelName of MODEL_CHAIN) {
    try {
      const text = await callModel(apiKey, modelName, prompt);
      const parsed = tryParseJson(text);
      if (parsed) {
        attempts.push({ model: modelName });
        return { data: parsed, modelUsed: modelName, attempts };
      }
      attempts.push({ model: modelName, error: 'invalid_json' });
      console.warn('[parse-meal] ' + modelName + ' returned non-JSON, preview:', text.slice(0, 200));
    } catch (err: any) {
      const msg = err?.message || String(err);
      attempts.push({ model: modelName, error: msg.slice(0, 160) });
      console.warn('[parse-meal] ' + modelName + ' failed:', msg);
    }
  }
  return { data: null, modelUsed: null, attempts };
}

async function enrichNutrition(foods: ParsedFoodRaw[], foodApiKey: string | undefined): Promise<any[]> {
  return Promise.all(
    foods.map(async (f) => {
      let updatedPrt = f.protein;
      let updatedFat = f.fat;
      let updatedCarbs = f.carbs;
      let updatedCals = f.calories;
      let updatedSod = f.sodium;

      if (foodApiKey && f.name) {
        try {
          const url =
            'https://api.data.go.kr/openapi/tn_pubr_public_nutri_info_api?serviceKey=' +
            foodApiKey +
            '&pageNo=1&numOfRows=1&type=json&foodNm=' +
            encodeURIComponent(f.name);
          const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
          const resText = await res.text();
          try {
            const resJson = JSON.parse(resText);
            const items = resJson?.response?.body?.items;
            if (items && items.length > 0) {
              const apiData = items[0];
              updatedCals = parseFloat(apiData.enerc || apiData.nutr_cont1) || updatedCals;
              updatedCarbs = parseFloat(apiData.chocdf || apiData.nutr_cont2) || updatedCarbs;
              updatedPrt = parseFloat(apiData.prt || apiData.nutr_cont3) || updatedPrt;
              updatedFat = parseFloat(apiData.fatce || apiData.nutr_cont4) || updatedFat;
              updatedSod = parseFloat(apiData.nat || apiData.nutr_cont6) || updatedSod;
            }
          } catch {}
        } catch {}
      }

      return {
        ...f,
        protein: updatedPrt ?? 0,
        fat: updatedFat ?? 0,
        carbs: updatedCarbs ?? 0,
        calories: updatedCals ?? 0,
        sodium: updatedSod ?? 0,
        glycemicIndex: f.glycemicIndex ?? 0,
        id: 'food_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      };
    }),
  );
}

export async function POST(req: Request) {
  try {
    const { voiceText } = await req.json();

    if (!voiceText?.trim()) {
      return NextResponse.json({ error: 'voiceText is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        parsedFoods: [],
        glucoseValue: undefined,
        detectedMeasType: 'random',
        detectedTime: undefined,
        confidenceScore: 0,
        needsClarification: true,
        clarificationQuestion: 'Gemini API 키가 서버에 설정되지 않았습니다. .env.local에 GEMINI_API_KEY를 추가해주세요.',
        _diagnostics: { modelUsed: null, attempts: [], reason: 'missing_api_key' },
      });
    }

    const mainPrompt = buildMainPrompt(voiceText);
    const primary = await generateWithFallback(apiKey, mainPrompt);
    let data: ParsedResponse | null = primary.data;
    let modelUsed = primary.modelUsed;
    const allAttempts = [...primary.attempts];

    const isEmptyRecognition = (d: ParsedResponse | null): boolean => {
      if (!d) return true;
      const noFoods = !d.parsedFoods || d.parsedFoods.length === 0;
      const noGlucose = d.glucoseValue == null || Number.isNaN(d.glucoseValue as any);
      return noFoods && noGlucose;
    };

    if (isEmptyRecognition(data)) {
      const recoveryPrompt = buildRecoveryPrompt(voiceText);
      const recovery = await generateWithFallback(apiKey, recoveryPrompt);
      allAttempts.push(
        ...recovery.attempts.map((a) => ({
          model: a.model,
          error: a.error ? 'recovery:' + a.error : 'recovery',
        })),
      );
      if (recovery.data && recovery.data.parsedFoods && recovery.data.parsedFoods.length > 0) {
        data = {
          ...(data || {}),
          parsedFoods: recovery.data.parsedFoods,
          needsClarification: false,
        };
        modelUsed = recovery.attempts.find((a) => !a.error)?.model ?? modelUsed;
      }
    }

    if (!data) {
      return NextResponse.json({
        parsedFoods: [],
        glucoseValue: undefined,
        detectedMeasType: 'random',
        detectedTime: undefined,
        confidenceScore: 0,
        needsClarification: true,
        clarificationQuestion: '모든 AI 모델이 응답하지 않았어요. 잠시 후 다시 시도하거나 직접 입력해주세요.',
        _diagnostics: { modelUsed: null, attempts: allAttempts, reason: 'all_models_failed' },
      });
    }

    const normalizedFoods: ParsedFoodRaw[] = (data.parsedFoods || []).map((f) => ({
      ...f,
      name: f.name?.toString().trim(),
      quantity: typeof f.quantity === 'number' && f.quantity > 0 ? f.quantity : 1,
      unit: f.unit?.toString().trim() || '인분',
      carbs: typeof f.carbs === 'number' ? Math.max(0, f.carbs) : 0,
      calories: typeof f.calories === 'number' ? Math.max(0, f.calories) : 0,
      glycemicIndex: typeof f.glycemicIndex === 'number' ? Math.max(0, Math.min(100, f.glycemicIndex)) : 0,
      protein: typeof f.protein === 'number' ? Math.max(0, f.protein) : 0,
      fat: typeof f.fat === 'number' ? Math.max(0, f.fat) : 0,
      sodium: typeof f.sodium === 'number' ? Math.max(0, f.sodium) : 0,
    }));

    const foodApiKey = process.env.FOOD_API_KEY;
    const enrichedFoods = await enrichNutrition(normalizedFoods, foodApiKey);

    const rawCandidates = Array.isArray(data.topCandidates) ? data.topCandidates : [];
    const topCandidates = rawCandidates
      .filter((c: any) => c && typeof c.name === 'string')
      .slice(0, 3)
      .map((c: any) => ({
        name: String(c.name).trim(),
        confidence: typeof c.confidence === 'number' ? Math.max(0, Math.min(1, c.confidence)) : 0.5,
        reason: typeof c.reason === 'string' ? c.reason : undefined,
      }));

    const effectiveNeedsClar = enrichedFoods.length === 0 && data.glucoseValue == null;

    return NextResponse.json({
      parsedFoods: enrichedFoods,
      glucoseValue: typeof data.glucoseValue === 'number' ? data.glucoseValue : undefined,
      detectedMeasType: data.detectedMeasType || 'random',
      detectedTime: data.detectedTime || undefined,
      confidenceScore: enrichedFoods.length > 0 || data.glucoseValue != null ? 0.9 : 0,
      needsClarification: effectiveNeedsClar,
      clarificationQuestion: effectiveNeedsClar
        ? data.clarificationQuestion || 'AI가 음식이나 혈당을 전혀 인식하지 못했어요. 좀 더 구체적으로 말씀해 주세요.'
        : undefined,
      topCandidates: topCandidates.length > 0 ? topCandidates : undefined,
      _diagnostics: {
        modelUsed,
        attempts: allAttempts,
        recovery: allAttempts.some((a) => a.error?.startsWith('recovery')) || undefined,
      },
    });
  } catch (error: any) {
    const msg = error?.message || 'Unknown error';
    console.error('Meal Parse API Error:', msg);
    return NextResponse.json(
      {
        parsedFoods: [],
        confidenceScore: 0,
        needsClarification: true,
        clarificationQuestion: '서버 오류가 발생했어요: ' + msg.slice(0, 160),
        _diagnostics: { modelUsed: null, attempts: [], reason: 'server_exception:' + msg.slice(0, 120) },
      },
      { status: 200 },
    );
  }
}
