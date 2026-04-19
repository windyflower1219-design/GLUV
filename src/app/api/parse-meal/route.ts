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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
      사용자의 음성 입력에서 음식 정보, 혈당 수치, 측정 시점을 추출해줘.
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
        "detectedTime": "시간 문맥이 있으면 24시간 HH:mm 형식으로 (아침→08:00, 점심→12:30, 저녁→18:30), 없으면 null",
        "needsClarification": 모호한 경우 true,
        "clarificationQuestion": "모호한 경우 친절한 질문"
      }

      지침:
      1. 한국 음식 영양 정보를 바탕으로 최대한 정확한 수치를 넣어줘.
      2. 수량이나 단위가 없으면 1인분을 기준으로 해.
      3. "혈당 120"과 같은 패턴이 있으면 glucoseValue에 숫자를 넣어.
      4. 문맥상 "공복", "식후 1시간" 등이 있으면 detectedMeasType을 정해줘. 없으면 "random".
      5. "아침에", "점심에", "어제 저녁" 등 시간적 맥락을 파악해서 detectedTime에 HH:mm 형태로 넣어줘.
      6. 사용자를 대하듯 따뜻하고 다정한 말투로 질문을 생성해줘.
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
