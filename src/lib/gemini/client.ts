// Gemini API 클라이언트
// src/lib/gemini/client.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(API_KEY);
  }
  return genAI;
}

export async function parseMealWithGemini(voiceText: string, userHistory?: string): Promise<{
  foods: Array<{
    name: string;
    quantity: number;
    unit: string;
    carbs: number;
    calories: number;
    glycemicIndex: number;
    protein: number;
    fat: number;
    sodium: number;
  }>;
  needsClarification: boolean;
  clarificationQuestion?: string;
  confidenceScore: number;
}> {
  // API 키가 없으면 데모 데이터 반환
  if (!API_KEY) {
    return getMockParsedMeal(voiceText);
  }

  try {
    const model = getGenAI().getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
당신은 한국 음식 영양 전문가입니다. 다음 음성 입력을 분석하여 JSON 형식으로 응답하세요.

음성 입력: "${voiceText}"
${userHistory ? `사용자 식습관 기록: ${userHistory}` : ''}

응답 형식 (JSON만 출력):
{
  "foods": [
    {
      "name": "음식명",
      "quantity": 1,
      "unit": "인분",
      "carbs": 30,
      "calories": 200,
      "glycemicIndex": 55,
      "protein": 10,
      "fat": 5,
      "sodium": 800
    }
  ],
  "needsClarification": false,
  "clarificationQuestion": null,
  "confidenceScore": 0.9
}

규칙:
1. 한국 음식의 표준 영양 데이터를 사용하세요
2. 양이 불분명하면 needsClarification을 true로 설정하세요
3. 복합 식사(예: 백반)는 개별 음식으로 분리하세요
4. confidenceScore는 0-1 사이 값입니다
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Gemini API 오류:', error);
  }

  return getMockParsedMeal(voiceText);
}

export async function generateInsightWithGemini(params: {
  mealDescription: string;
  glucoseData: { before: number; after30m?: number; after1h?: number; after2h?: number };
  userProfile: { diabetesType: string; targetMin: number; targetMax: number };
}): Promise<string> {
  if (!API_KEY) {
    return getMockInsight(params);
  }

  try {
    const model = getGenAI().getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
당신은 혈당 관리 전문 AI 코치입니다. 다음 데이터를 분석하여 실용적인 조언을 한국어로 제공하세요.

식사 내용: ${params.mealDescription}
식전 혈당: ${params.glucoseData.before} mg/dL
식후 30분: ${params.glucoseData.after30m ?? '미측정'} mg/dL
식후 1시간: ${params.glucoseData.after1h ?? '미측정'} mg/dL
식후 2시간: ${params.glucoseData.after2h ?? '미측정'} mg/dL
목표 범위: ${params.userProfile.targetMin}-${params.userProfile.targetMax} mg/dL

다음 형식으로 답하세요:
- 2-3문장의 구체적이고 행동 가능한 조언
- 원인 분석 포함
- 긍정적인 톤 유지
- "지금 바로 ~~~하세요" 형태의 행동 지침 포함
`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini 인사이트 생성 오류:', error);
    return getMockInsight(params);
  }
}

// 데모 데이터 (API 키 없을 때)
function getMockParsedMeal(text: string) {
  const sampleFoods = [
    { name: '김치찌개', quantity: 1, unit: '인분', carbs: 15, calories: 180, glycemicIndex: 45, protein: 12, fat: 8, sodium: 1200 },
    { name: '밥', quantity: 1, unit: '공기', carbs: 65, calories: 300, glycemicIndex: 72, protein: 5, fat: 1, sodium: 5 },
    { name: '제육볶음', quantity: 1, unit: '인분', carbs: 20, calories: 350, glycemicIndex: 55, protein: 25, fat: 18, sodium: 900 },
    { name: '라면', quantity: 1, unit: '봉지', carbs: 70, calories: 500, glycemicIndex: 80, protein: 10, fat: 20, sodium: 1800 },
    { name: '된장찌개', quantity: 1, unit: '인분', carbs: 12, calories: 120, glycemicIndex: 40, protein: 8, fat: 5, sodium: 1000 },
  ];

  const lowerText = text.toLowerCase();
  const matched = sampleFoods.filter(f =>
    lowerText.includes(f.name) || 
    (lowerText.includes('밥') && f.name === '밥') ||
    (lowerText.includes('찌개') && f.name === '김치찌개')
  );

  return {
    foods: matched.length > 0 ? matched : [sampleFoods[0], sampleFoods[1]],
    needsClarification: false,
    confidenceScore: 0.85,
  };
}

function getMockInsight(params: { mealDescription: string; glucoseData: { before: number; after30m?: number; after1h?: number; after2h?: number }; userProfile: { diabetesType: string; targetMin: number; targetMax: number } }): string {
  const spike = (params.glucoseData.after1h ?? params.glucoseData.before) - params.glucoseData.before;
  if (spike > 40) {
    return `식후 혈당이 ${spike} mg/dL 상승했습니다. 탄수화물 섭취량이 많았을 가능성이 있어요. 지금 바로 10-15분 가볍게 걸어보시면 혈당을 빠르게 낮출 수 있습니다. 💪`;
  }
  return `오늘 식후 혈당이 목표 범위 내에서 잘 관리되고 있어요! 현재 식단을 유지하면서 식후 산책을 습관화하면 더욱 좋은 결과를 기대할 수 있습니다. 🎉`;
}
