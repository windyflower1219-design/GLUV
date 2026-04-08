// 음식 NLP 파서 (로컬 + OpenAI 하이브리드)
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FoodItem, VoiceParseResult, MeasurementType } from '@/types';

// API 키 설정 (인사이트 등에 사용되는 제미니 유지, OpenAI 신규 추가)
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true,
});

// 한국 음식 영양 데이터베이스 (로컬 캐시)
const KOREAN_FOOD_DB: Record<string, Omit<FoodItem, 'id' | 'quantity'>> = {
  '밥': { name: '밥', unit: '공기', carbs: 65, calories: 300, glycemicIndex: 72, protein: 5, fat: 1, sodium: 5 },
  '흰밥': { name: '흰밥', unit: '공기', carbs: 65, calories: 300, glycemicIndex: 72, protein: 5, fat: 1, sodium: 5 },
  '현미밥': { name: '현미밥', unit: '공기', carbs: 58, calories: 280, glycemicIndex: 55, protein: 6, fat: 2, sodium: 3 },
  '김치찌개': { name: '김치찌개', unit: '인분', carbs: 15, calories: 180, glycemicIndex: 45, protein: 12, fat: 8, sodium: 1200 },
  '된장찌개': { name: '된장찌개', unit: '인분', carbs: 12, calories: 120, glycemicIndex: 40, protein: 8, fat: 5, sodium: 1000 },
  '제육볶음': { name: '제육볶음', unit: '인분', carbs: 20, calories: 350, glycemicIndex: 55, protein: 25, fat: 18, sodium: 900 },
  '불고기': { name: '불고기', unit: '인분', carbs: 18, calories: 320, glycemicIndex: 50, protein: 28, fat: 15, sodium: 800 },
  '삼겹살': { name: '삼겹살', unit: '인분', carbs: 0, calories: 430, glycemicIndex: 0, protein: 22, fat: 38, sodium: 400 },
  '라면': { name: '라면', unit: '봉지', carbs: 70, calories: 500, glycemicIndex: 80, protein: 10, fat: 20, sodium: 1800 },
  '짜장면': { name: '짜장면', unit: '인분', carbs: 85, calories: 680, glycemicIndex: 75, protein: 18, fat: 22, sodium: 1500 },
  '짬뽕': { name: '짬뽕', unit: '인분', carbs: 80, calories: 620, glycemicIndex: 72, protein: 22, fat: 18, sodium: 2200 },
  '비빔밥': { name: '비빔밥', unit: '인분', carbs: 78, calories: 580, glycemicIndex: 68, protein: 18, fat: 14, sodium: 900 },
  '순두부찌개': { name: '순두부찌개', unit: '인분', carbs: 10, calories: 150, glycemicIndex: 35, protein: 14, fat: 10, sodium: 950 },
  '갈비탕': { name: '갈비탕', unit: '인분', carbs: 20, calories: 380, glycemicIndex: 40, protein: 32, fat: 22, sodium: 700 },
  '삼계탕': { name: '삼계탕', unit: '인분', carbs: 35, calories: 450, glycemicIndex: 55, protein: 40, fat: 20, sodium: 600 },
  '치킨': { name: '치킨', unit: '조각', carbs: 15, calories: 280, glycemicIndex: 45, protein: 22, fat: 18, sodium: 700 },
  '피자': { name: '피자', unit: '조각', carbs: 35, calories: 280, glycemicIndex: 60, protein: 12, fat: 12, sodium: 800 },
  '햄버거': { name: '햄버거', unit: '개', carbs: 45, calories: 500, glycemicIndex: 65, protein: 25, fat: 28, sodium: 1000 },
  '샌드위치': { name: '샌드위치', unit: '개', carbs: 38, calories: 380, glycemicIndex: 58, protein: 18, fat: 16, sodium: 850 },
  '샐러드': { name: '샐러드', unit: '인분', carbs: 10, calories: 80, glycemicIndex: 20, protein: 3, fat: 3, sodium: 200 },
  '바나나': { name: '바나나', unit: '개', carbs: 27, calories: 105, glycemicIndex: 51, protein: 1, fat: 0, sodium: 1 },
  '사과': { name: '사과', unit: '개', carbs: 25, calories: 95, glycemicIndex: 36, protein: 0, fat: 0, sodium: 2 },
  '오렌지주스': { name: '오렌지주스', unit: '컵', carbs: 26, calories: 110, glycemicIndex: 50, protein: 2, fat: 0, sodium: 2 },
  '커피': { name: '커피', unit: '잔', carbs: 3, calories: 15, glycemicIndex: 0, protein: 0, fat: 0, sodium: 10 },
  '아메리카노': { name: '아메리카노', unit: '잔', carbs: 1, calories: 5, glycemicIndex: 0, protein: 0, fat: 0, sodium: 5 },
  '라떼': { name: '라떼', unit: '잔', carbs: 15, calories: 120, glycemicIndex: 30, protein: 6, fat: 5, sodium: 80 },
  // 신규 추가분
  '국밥': { name: '국밥', unit: '그릇', carbs: 65, calories: 450, glycemicIndex: 65, protein: 25, fat: 15, sodium: 1200 },
  '김밥': { name: '김밥', unit: '줄', carbs: 70, calories: 480, glycemicIndex: 60, protein: 12, fat: 14, sodium: 900 },
  '돈까스': { name: '돈까스', unit: '인분', carbs: 45, calories: 600, glycemicIndex: 65, protein: 28, fat: 35, sodium: 1100 },
  '초밥': { name: '초밥', unit: '인분', carbs: 85, calories: 550, glycemicIndex: 70, protein: 22, fat: 10, sodium: 1300 },
  '마라탕': { name: '마라탕', unit: '인분', carbs: 40, calories: 800, glycemicIndex: 55, protein: 20, fat: 45, sodium: 2500 },
  '떡볶이': { name: '떡볶이', unit: '인분', carbs: 110, calories: 600, glycemicIndex: 85, protein: 15, fat: 8, sodium: 1500 },
  '냉면': { name: '냉면', unit: '그릇', carbs: 85, calories: 480, glycemicIndex: 72, protein: 15, fat: 5, sodium: 1800 },
  '칼국수': { name: '칼국수', unit: '그릇', carbs: 75, calories: 450, glycemicIndex: 70, protein: 15, fat: 6, sodium: 1600 },
  '우동': { name: '우동', unit: '그릇', carbs: 70, calories: 420, glycemicIndex: 75, protein: 12, fat: 4, sodium: 1700 },
  '파스타': { name: '파스타', unit: '인분', carbs: 65, calories: 500, glycemicIndex: 55, protein: 18, fat: 15, sodium: 800 },
  '스테이크': { name: '스테이크', unit: '인분', carbs: 0, calories: 450, glycemicIndex: 0, protein: 45, fat: 30, sodium: 600 },
  '탕수육': { name: '탕수육', unit: '인분', carbs: 45, calories: 550, glycemicIndex: 65, protein: 20, fat: 28, sodium: 800 },
  '볶음밥': { name: '볶음밥', unit: '인분', carbs: 75, calories: 520, glycemicIndex: 70, protein: 12, fat: 18, sodium: 900 },
  '된장국': { name: '된장국', unit: '그릇', carbs: 8, calories: 60, glycemicIndex: 40, protein: 5, fat: 2, sodium: 800 },
  '미역국': { name: '미역국', unit: '그릇', carbs: 5, calories: 80, glycemicIndex: 35, protein: 6, fat: 3, sodium: 700 },
  '김치전': { name: '김치전', unit: '조각', carbs: 30, calories: 250, glycemicIndex: 60, protein: 5, fat: 12, sodium: 600 },
  '만두': { name: '만두', unit: '개', carbs: 8, calories: 50, glycemicIndex: 65, protein: 3, fat: 2, sodium: 120 },
  '계란후라이': { name: '계란후라이', unit: '개', carbs: 1, calories: 90, glycemicIndex: 0, protein: 6, fat: 7, sodium: 65 },
  '달걀말이': { name: '달걀말이', unit: '조각', carbs: 2, calories: 70, glycemicIndex: 0, protein: 5, fat: 5, sodium: 100 },
  '고구마': { name: '고구마', unit: '개', carbs: 30, calories: 130, glycemicIndex: 55, protein: 2, fat: 0, sodium: 15 },
  '감자': { name: '감자', unit: '개', carbs: 25, calories: 110, glycemicIndex: 80, protein: 3, fat: 0, sodium: 10 },
  '옥수수': { name: '옥수수', unit: '개', carbs: 20, calories: 100, glycemicIndex: 55, protein: 3, fat: 1, sodium: 5 },
  '우유': { name: '우유', unit: '컵', carbs: 12, calories: 130, glycemicIndex: 30, protein: 8, fat: 7, sodium: 120 },
  '요거트': { name: '요거트', unit: '컵', carbs: 15, calories: 100, glycemicIndex: 35, protein: 5, fat: 2, sodium: 60 },
  '아이스크림': { name: '아이스크림', unit: '개', carbs: 25, calories: 200, glycemicIndex: 65, protein: 3, fat: 10, sodium: 50 },
  '케이크': { name: '케이크', unit: '조각', carbs: 35, calories: 300, glycemicIndex: 70, protein: 4, fat: 15, sodium: 150 },
  '과자': { name: '과자', unit: '봉지', carbs: 40, calories: 250, glycemicIndex: 75, protein: 2, fat: 12, sodium: 300 },
  '초콜릿': { name: '초콜릿', unit: '조각', carbs: 15, calories: 110, glycemicIndex: 45, protein: 1, fat: 6, sodium: 10 },
  '포도': { name: '포도', unit: '송이', carbs: 45, calories: 180, glycemicIndex: 50, protein: 1, fat: 0, sodium: 5 },
  '수박': { name: '수박', unit: '조각', carbs: 12, calories: 50, glycemicIndex: 72, protein: 1, fat: 0, sodium: 2 },
  '사이다': { name: '사이다', unit: '캔', carbs: 30, calories: 120, glycemicIndex: 65, protein: 0, fat: 0, sodium: 15 },
  '콜라': { name: '콜라', unit: '캔', carbs: 35, calories: 140, glycemicIndex: 65, protein: 0, fat: 0, sodium: 10 },
  '맥주': { name: '맥주', unit: '캔', carbs: 12, calories: 150, glycemicIndex: 85, protein: 1, fat: 0, sodium: 15 },
  '소주': { name: '소주', unit: '병', carbs: 0, calories: 400, glycemicIndex: 0, protein: 0, fat: 0, sodium: 0 },
};

// 수량 표현 파서
const QUANTITY_PATTERNS: Array<{ pattern: RegExp; quantity: number; unit: string }> = [
  { pattern: /반\s*(개|인분|공기|그릇|봉지)?/, quantity: 0.5, unit: '인분' },
  { pattern: /한\s*(개|인분|공기|그릇|봉지)/, quantity: 1, unit: '인분' },
  { pattern: /두\s*(개|인분|공기|그릇|봉지)/, quantity: 2, unit: '인분' },
  { pattern: /세\s*(개|인분|공기|그릇|봉지)/, quantity: 3, unit: '인분' },
  { pattern: /(\d+\.?\d*)\s*(개|인분|공기|그릇|봉지|조각|컵|잔)/, quantity: 1, unit: '인분' },
  { pattern: /조금|약간|살짝/, quantity: 0.3, unit: '인분' },
  { pattern: /많이|듬뿍|가득/, quantity: 1.5, unit: '인분' },
];

function extractQuantity(text: string): { quantity: number; unit: string } {
  for (const { pattern, unit } of QUANTITY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // 숫자가 있으면 숫자 추출
      const numMatch = match[0].match(/(\d+\.?\d*)/);
      const quantity = numMatch ? parseFloat(numMatch[1]) : QUANTITY_PATTERNS.find(p => p.pattern === pattern)?.quantity ?? 1;
      const extractedUnit = match[1] || unit;
      const unitMap: Record<string, string> = { '공기': '공기', '그릇': '그릇', '봉지': '봉지', '조각': '조각', '컵': '컵', '잔': '잔', '개': '개', '인분': '인분' };
      return { quantity, unit: unitMap[extractedUnit] || unit };
    }
  }
  return { quantity: 1, unit: '인분' };
}

function findFoodInText(text: string): Array<{ foodKey: string; position: number }> {
  const found: Array<{ foodKey: string; position: number }> = [];
  const foodKeys = Object.keys(KOREAN_FOOD_DB);

  // 긴 이름 먼저 매칭 (예: "김치찌개"가 "찌개"보다 먼저)
  const sortedKeys = foodKeys.sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const idx = text.indexOf(key);
    if (idx !== -1) {
      // 이미 매칭된 영역과 겹치지 않는지 확인
      const overlaps = found.some(f => Math.abs(f.position - idx) < key.length);
      if (!overlaps) {
        found.push({ foodKey: key, position: idx });
      }
    }
  }

  return found.sort((a, b) => a.position - b.position);
}

// ======================================================
// 메인 파서 함수
// ======================================================
export async function parseMealText(
  voiceText: string,
): Promise<VoiceParseResult> {
  const useOpenAI = !!process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  if (useOpenAI) {
    try {
      const prompt = `
        사용자의 음성 입력에서 음식 정보와 혈당 수치를 추출해줘.
        입력: "${voiceText}"

        다음 JSON 형식으로만 응답해:
        {
          "parsedFoods": [
            {
              "name": "음식명",
              "quantity": 수량(숫자),
              "unit": "단위",
              "carbs": 탄수화물(g),
              "calories": 칼로리(kcal),
              "glycemicIndex": 혈당지수(0-100),
              "protein": 단백질(g),
              "fat": 지방(g),
              "sodium": 나트륨(mg)
            }
          ],
          "glucoseValue": 혈당수치(숫자, 없으면 null),
          "detectedMeasType": "fasting" | "postmeal_30m" | "postmeal_1h" | "postmeal_2h" | "random",
          "needsClarification": 모호한 경우 true,
          "clarificationQuestion": "모호한 경우 사용자에게 던질 친절한 질문"
        }

        지침:
        1. 한국 음식 영양 정보를 바탕으로 최대한 정확한 수치를 넣어줘. 
        2. 수량이나 단위가 없으면 1인분을 기준으로 해.
        3. "혈당 120"과 같은 패턴이 있으면 glucoseValue에 숫자를 넣어.
        4. 문맥상 "공복", "식후 1시간" 등이 있으면 detectedMeasType을 정해줘. 없으면 "random".
        5. 사용자를 대하듯 따뜻하고 다정한 말투로 질문을 생성해줘.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: prompt }],
        response_format: { type: "json_object" }
      });

      const text = response.choices[0].message.content || '{}';
      const data = JSON.parse(text);

      return {
        rawText: voiceText,
        parsedFoods: (data.parsedFoods || []).map((f: any) => ({
          ...f,
          id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        })),
        glucoseValue: data.glucoseValue || undefined,
        detectedMeasType: (data.detectedMeasType as MeasurementType) || 'random',
        confidenceScore: 0.9,
        needsClarification: !!data.needsClarification,
        clarificationQuestion: data.clarificationQuestion,
      };
    } catch (error) {
      console.warn('OpenAI Parsing Error, falling back to local fallback:', error);
      // Fall through to local fallback
    }
  }

  // --- Local Fallback Parser ---
  const foundFoods = findFoodInText(voiceText);
  let glucoseMatch = voiceText.match(/혈당\s*(\d{2,3})/);
  if (!glucoseMatch) glucoseMatch = voiceText.match(/(\d{2,3})\s*나왔어/);
  const glucoseValue = glucoseMatch ? parseInt(glucoseMatch[1]) : undefined;
  
  let detectedMeasType: MeasurementType = 'random';
  if (voiceText.includes('공복')) detectedMeasType = 'fasting';
  else if (voiceText.includes('식후 2시간')) detectedMeasType = 'postmeal_2h';
  else if (voiceText.includes('식후 1시간') || voiceText.includes('식후')) detectedMeasType = 'postmeal_1h';

  if (foundFoods.length > 0) {
    const parsedFoods = foundFoods.map(f => {
      const base = KOREAN_FOOD_DB[f.foodKey];
      // 간단한 수량 매칭
      const qtyInfo = extractQuantity(voiceText);
      return {
        id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: base.name,
        quantity: qtyInfo.quantity,
        unit: qtyInfo.unit,
        carbs: base.carbs,
        calories: base.calories,
        glycemicIndex: base.glycemicIndex,
        protein: base.protein,
        fat: base.fat,
        sodium: base.sodium
      };
    });

    return {
      rawText: voiceText,
      parsedFoods,
      glucoseValue,
      detectedMeasType,
      confidenceScore: 0.6,
      needsClarification: false,
    };
  }

  // If even local parser couldn't find foods but found glucose:
  if (glucoseValue) {
    return {
      rawText: voiceText,
      parsedFoods: [],
      glucoseValue,
      detectedMeasType,
      confidenceScore: 0.8,
      needsClarification: false,
    };
  }

  return {
    rawText: voiceText,
    parsedFoods: [],
    confidenceScore: 0,
    needsClarification: true,
    clarificationQuestion: '죄송해요, 조금 더 구체적으로 음식 이름이나 혈당 수치를 말씀해 주시겠어요?',
  };
}

export type { VoiceParseResult };
