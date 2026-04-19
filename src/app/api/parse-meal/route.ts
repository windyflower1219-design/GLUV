import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { voiceText } = await req.json();

    if (!voiceText?.trim()) {
      return NextResponse.json({ error: 'voiceText is required' }, { status: 400 });
    }

    // 서버사이드 전용 키 우선 사용
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is missing' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // GAN-loop 튜닝 완료 모델: Gemma 3 27B (무료 14,400 RPD. Gemini 2.5 Flash 20 RPD 대비 720배).
    // 검증: Round 0 seed composite 0.9803 (20/20), Round 1 adversarial 0.9310 (9/10), Round 2 0.8728 (9/10).
    const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

    // 아래 프롬프트는 scripts/gan-loop/state/prompt.current.txt 의 튜닝된 최신본.
    // 수정 시 GAN 루프 프롬프트도 함께 업데이트할 것.
    const prompt = `사용자의 음성 입력에서 음식 정보, 혈당 수치, 측정 시점을 추출해줘.
입력: "${voiceText}"

다음 JSON 형식으로만 응답해 (다른 텍스트나 포맷팅은 절대 넣지 말고 순수 JSON만 출력해):
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
  "detectedTime": "시간 문맥이 있으면 24시간 HH:mm 형식, 없으면 null",
  "needsClarification": 모호한 경우 true,
  "clarificationQuestion": "모호한 경우 친절한 질문"
}

지침:

1. 영양 정보는 한국 음식 기준 평균값으로 채워줘. 자신 없으면 null.

2. 수량/단위 규칙:
   - 한국어 한정사("하나", "한", "두", "세", "반" 등)는 반드시 음식에 맞는 고유 단위로 정규화할 것.
   - 고정 매핑표 (우선 적용):
     · 라면 → 봉지
     · 김밥 → 줄
     · 피자 → 조각
     · 치킨 → 마리
     · 만두 → 개
     · 맥주, 콜라, 사이다, 캔 음료 → 캔
     · 커피, 아메리카노, 라떼, 차 → 잔
     · 샌드위치, 햄버거 → 개
     · 삼겹살 → 인분
     · 떡볶이, 파스타, 샐러드, 짜장면, 짬뽕 → 인분
     · 비빔밥, 국밥, 돼지국밥, 순대국밥, 된장찌개, 된장국, 밥 → 그릇
   - 매핑표에 없는 음식은 "인분"을 기본값으로.
   - 수량이 명시되지 않으면 1.
   - **복합 분수 표현**:
     · "N 반" = N + 0.5  (예: "한 줄 반" = 1.5, "1인분 반" = 1.5, "두 그릇 반" = 2.5)
     · "반", "반 인분", "반 그릇" = 0.5
     · "삼분의 일" = 0.33, "사분의 일" = 0.25
   - **어림 수량어** (실제 섭취량 기준으로 추정):
     · "조금만", "약간", "살짝", "쪼끔" = 0.3
     · "좀 많이", "많이", "배불리" = 1.5
     · "실컷", "엄청" = 2
   - **조리량 ≠ 섭취량**: "끓였는데 반만 먹었어" / "차렸는데 조금만" 같은 경우, **실제 먹은 양**을 기록.
     예) "라면 한 봉지 끓였는데 반만 먹었어" → quantity 0.5 (먹은 양)

3. glucoseValue — 혈당 수치 추출:
   - "혈당 120", "120 나왔어", "수치가 150" 같은 수치 언급을 정수로 추출.
   - **한글 숫자도 반드시 아라비아 숫자로 변환**:
     · 예: "백이십" → 120, "백오십" → 150, "백칠십오" → 175, "이백" → 200, "구십이" → 92
   - **혈당 관련 숫자가 없으면 null.**

4. quantity vs glucoseValue 구분 규칙 — 중요:
   - 수량(quantity)은 음식 바로 뒤에 단위와 함께: "만두 12개", "김밥 두 줄", "라면 하나"
   - 혈당(glucoseValue)은 단위 없는 맨 숫자이거나 "혈당", "수치" 같은 키워드와 함께: "120 나왔어", "혈당 148", "수치가 170"
   - 예) "만두 12개 먹고 120 나왔어" → quantity=12 (만두), glucoseValue=120
   - 예) "김밥 두 줄 먹고 혈당 백칠십오" → quantity=2 (김밥), glucoseValue=175

5. 부정/미섭취 표현 — 음식 환각 금지:
   - "안 먹었다", "먹지 않았다", "아무것도 안 먹었다", "굶었다", "식사를 거르다" 같은 부정 표현이 나오면
     반드시 parsedFoods=[] (빈 배열).
   - "먹었는데" 같은 동사 어미에 속지 말고 문장 전체의 부정어를 먼저 체크할 것.
   - 예) "오늘 아침엔 아무것도 안 먹었는데 공복혈당 92" → parsedFoods=[], glucoseValue=92, measType=fasting, time=08:00

6. detectedMeasType — **과잉 추론 금지**:
   - 다음 키워드가 **명시적으로** 있을 때만 해당 값으로:
     · "공복", "자고 일어나서", "아침 공복", "먹기 전" → fasting
     · "식후 30분", "30분 뒤", "30분 후" → postmeal_30m
     · "식후 1시간", "한 시간 뒤", "1시간 후", "식후" (시간 미명시) → postmeal_1h
     · "식후 2시간", "2시간 뒤", "2시간 후", "한참 뒤", "한참 있다가", "꽤 지나서" → postmeal_2h
   - 위 키워드가 **하나도 없으면 반드시 "random"**.
   - 🚫 금지: "음식을 먹었다"는 사실만으로 postmeal_* 추론 금지.
     예) "비빔밥 먹고 혈당 120" → random (키워드 없음)
     예) "점심에 짬뽕 먹었는데 혈당 148" → random (시간대는 있어도 측정타이밍 키워드 없음)
     예) "짜장면 먹고 한 시간 뒤에 140" → postmeal_1h (명시적 "한 시간 뒤")

7. detectedTime — 고정 매핑표:
   - 자정 → 00:00
   - 새벽 → 02:00
   - 아침 → 08:00
   - 오전 → 10:00
   - 점심, 정오 → 12:30
   - 오후 → 15:00
   - 저녁 → 18:30
   - 밤 → 22:00
   - "어제"/"오늘" 등 날짜어는 시간에 영향 없음 (시간대 키워드만 반영).
   - **명시적 숫자 시간이 있으면 고정매핑 override**: "새벽 3시" → 03:00, "아침 7시" → 07:00, "저녁 7시" → 19:00. 숫자 시간 우선.
   - 시간대 키워드가 하나도 없으면 null.

8. 사투리/구어체 정규화:
   - 경상도: "묵었다"/"묵었어" = 먹었다, "나와뿌렀다" = 나왔다, "마" = (감탄사, 무시), "아이고" = (감탄사, 무시)
   - 전라도: "먹었어라" = 먹었어, "혔다" = 했다
   - 제주: "먹읍서" = 먹었어요
   - 사투리 동사는 표준어 의미로 해석하되 음식명/수치는 있는 그대로 추출.
   - 감탄사("아이고", "어머", "마", "참")는 파싱에 영향 주지 않음.

9. needsClarification:
   - 음식도 혈당도 전혀 식별되지 않거나 "그거", "아까 그거" 같이 지시대명사만 있을 때 true.
   - 그 외 false.
   - true일 때 clarificationQuestion을 따뜻하고 다정한 말투로.
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Markdown JSON 블록 제거 처리
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // JSON 파싱 시도
    let data;
    try {
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
         text = text.slice(jsonStart, jsonEnd + 1);
      }
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON. Raw response:', text);
      throw new Error('Invalid JSON response from AI');
    }

    const foodApiKey = process.env.FOOD_API_KEY;
    const enrichedFoods = await Promise.all((data.parsedFoods || []).map(async (f: any) => {
      let updatedPrt = f.protein;
      let updatedFat = f.fat;
      let updatedCarbs = f.carbs;
      let updatedCals = f.calories;
      let updatedSod = f.sodium;

      if (foodApiKey) {
        try {
          const url = `https://api.data.go.kr/openapi/tn_pubr_public_nutri_info_api?serviceKey=${foodApiKey}&pageNo=1&numOfRows=1&type=json&foodNm=${encodeURIComponent(f.name)}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
          const resText = await res.text();
          
          try {
            const resJson = JSON.parse(resText);
            // resultCode: "00" 보통 정상. 근데 "0"이나 "00"으로 올 수 있음
            const items = resJson?.response?.body?.items;
            if (items && items.length > 0) {
              const apiData = items[0];
              // 공공데이터 속성명 (enerc, chocdf 등) 적용. 없으면 영양성분1,2,3(nutr_cont)도 체크
              updatedCals = parseFloat(apiData.enerc || apiData.nutr_cont1) || updatedCals;
              updatedCarbs = parseFloat(apiData.chocdf || apiData.nutr_cont2) || updatedCarbs;
              updatedPrt = parseFloat(apiData.prt || apiData.nutr_cont3) || updatedPrt;
              updatedFat = parseFloat(apiData.fatce || apiData.nutr_cont4) || updatedFat;
              updatedSod = parseFloat(apiData.nat || apiData.nutr_cont6) || updatedSod;
              console.log(`[API 연동 완료] ${f.name} 데이터 갱신 성공`);
            } else {
              console.log(`[API 조회 실패] ${f.name} 결과 없음. Gemini 추정치 사용.`);
            }
          } catch(err) {
             console.log(`[API 미등록/에러] ${f.name} - 아직 키가 활성화되지 않았습니다. Gemini 추정치 사용.`);
          }
        } catch (e) {
          console.warn(`[API 타임아웃/오류] ${f.name} - Gemini 추정치 사용.`);
        }
      }

      return {
        ...f,
        protein: updatedPrt,
        fat: updatedFat,
        carbs: updatedCarbs,
        calories: updatedCals,
        sodium: updatedSod,
        id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };
    }));

    return NextResponse.json({
      parsedFoods: enrichedFoods,
      glucoseValue: data.glucoseValue || undefined,
      detectedMeasType: data.detectedMeasType || 'random',
      detectedTime: data.detectedTime || undefined,
      confidenceScore: 0.9,
      needsClarification: !!data.needsClarification,
      clarificationQuestion: data.clarificationQuestion,
    });
  } catch (error: any) {
    console.error('Meal Parse API Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
