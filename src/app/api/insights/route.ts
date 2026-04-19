import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  // 요청마다 키를 새로 읽음 (모듈 캐시 문제 방지)
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

  try {
    const { userId, recentMeals, averageGlucose } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is missing' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const mealsText = Array.isArray(recentMeals) && recentMeals.length > 0
      ? recentMeals.join(', ')
      : '아직 식사 기록 없음';

    const glucoseText = averageGlucose && averageGlucose > 0
      ? `${averageGlucose} mg/dL`
      : '아직 혈당 기록 없음';

    const prompt = `당신은 당뇨 예방 및 혈당 관리를 돕는 GLUV 앱의 따뜻하고 다정한 건강 비서입니다.

회원님의 최근 건강 데이터:
- 평균 혈당: ${glucoseText}
- 최근 식사: ${mealsText}

위 데이터를 바탕으로 맞춤형 인사이트 3가지를 JSON 배열로만 응답해주세요. 다른 설명 없이 JSON 배열만 출력하세요.

응답 형식:
[
  {
    "id": "insight_1",
    "type": "recommendation",
    "title": "💡 제목",
    "message": "따뜻하고 다정한 존댓말로 작성된 내용. 남편/아내 등 호칭 사용 금지.",
    "emoji": "💡",
    "actionLabel": "버튼 텍스트 (선택사항)"
  }
]

type 값은 spike_alert, prediction, recommendation, achievement, warning 중 하나.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // JSON 블록 추출 (```json ... ``` 또는 [ ... ] 형태 모두 처리)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Gemini did not return valid JSON array. Raw response:', text);
      return NextResponse.json({ error: 'Invalid response format from Gemini' }, { status: 500 });
    }

    const insights = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ insights }, { status: 200 });

  } catch (error: any) {
    console.error('Insights API Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
