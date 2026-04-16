import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemma API 설정 (이전 Gemini 기반)
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { userId, recentMeals, averageGlucose, isDemo } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'Gemma API key is missing' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemma-4' });

    const prompt = `
      당신은 당뇨 예방 및 혈당 관리를 돕는 'GLUV' 앱의 따뜻하고 다정한 건강 비서입니다.
      아래는 회원님("${userId}")의 최근 건강 데이터입니다:
      - 평균 혈당: ${averageGlucose} mg/dL
      - 최근 식사 기록: ${JSON.stringify(recentMeals)}

      이 데이터를 바탕으로, 회원님을 위해 가장 유용한 행동 가능 인사이트(Actionable Insight) 3가지를 배열 형태로 제안해주세요.
      배열의 각 항목은 다음 필드를 가져야 합니다:
      id: "string", 랜덤 아이디값 (예: 'insight_1')
      type: "spike_alert" | "prediction" | "recommendation" | "achievement" | "warning" 중 택일
      title: "string", (예: '🚨 혈당이 조금 높아질 수 있어요!')
      message: "string", (따뜻하고 다정하게, 공감하는 말투. '남편'이나 '아내' 같은 단어는 쓰지 마세요. 무조건 존댓말 사용)
      emoji: "string", 1개의 이모지 (예: '🏃')
      actionLabel: "string", (선택사항, 버튼 텍스트 예: '추천 운동 보기')

      형식은 반드시 순수 JSON 배열이어야 합니다. 예:
      [
        {
          "id": "insight_1",
          "type": "recommendation",
          "title": "💡 회원님을 위한 꿀팁",
          "message": "최근 식단에 단백질이 조금 부족해보입니다. 닭가슴살 샐러드 어떠세요?",
          "emoji": "🥗"
        }
      ]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const insights = JSON.parse(text);

    return NextResponse.json({ insights }, { status: 200 });
  } catch (error: any) {
    console.error('Insights API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
