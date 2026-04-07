// 음식 NLP 파서 (로컬 + Gemini API 하이브리드)
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FoodItem, VoiceParseResult, MeasurementType } from '@/types';

// API 키 설정
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

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
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
      5. 아내분을 대하듯 따뜻하고 부드러운 말투로 질문을 생성해줘.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON 추출 (Markdown backticks 제거)
    const jsonStr = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(jsonStr);

    return {
      rawText: voiceText,
      parsedFoods: data.parsedFoods.map((f: any) => ({
        ...f,
        id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      })),
      glucoseValue: data.glucoseValue || undefined,
      detectedMeasType: data.detectedMeasType as MeasurementType,
      confidenceScore: 0.9,
      needsClarification: !!data.needsClarification,
      clarificationQuestion: data.clarificationQuestion,
    };
  } catch (error) {
    console.error('Gemini Parsing Error:', error);
    return {
      rawText: voiceText,
      parsedFoods: [],
      confidenceScore: 0,
      needsClarification: true,
      clarificationQuestion: '죄송해요, 분석 중에 작은 실수가 있었어요. 다시 한 번 말씀해 주실래요?',
    };
  }
}

export type { VoiceParseResult };
