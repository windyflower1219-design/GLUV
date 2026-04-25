import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';

// GET /api/meals?userId=xxx&date=YYYY-MM-DD   → 특정 날짜 식단
// GET /api/meals?userId=xxx&days=30           → 최근 N일 식단
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get('userId');
  const date = searchParams.get('date');
  const days = searchParams.get('days');

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  try {
    let rows;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      rows = await sql`
        SELECT * FROM meals
        WHERE user_id = ${userId}
          AND timestamp >= ${start.toISOString()}
          AND timestamp <= ${end.toISOString()}
        ORDER BY timestamp DESC
      `;
    } else {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(days || '30'));
      rows = await sql`
        SELECT * FROM meals
        WHERE user_id = ${userId}
          AND timestamp >= ${cutoff.toISOString()}
        ORDER BY timestamp DESC
      `;
    }
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('[meals GET]', error);
    return NextResponse.json([], { status: 200 }); // 읽기 실패는 빈 배열 반환
  }
}

// POST /api/meals  → 식단 저장, { id } 반환
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, userId, timestamp, mealType, rawVoiceInput, parsedFoods, totalCarbs, totalCalories, glucotypeScore } = body;

    await sql`
      INSERT INTO meals (id, user_id, timestamp, meal_type, raw_voice_input, parsed_foods, total_carbs, total_calories, glucotype_score)
      VALUES (
        ${id},
        ${userId},
        ${new Date(timestamp).toISOString()},
        ${mealType},
        ${rawVoiceInput ?? ''},
        ${JSON.stringify(parsedFoods ?? [])}::jsonb,
        ${totalCarbs ?? 0},
        ${totalCalories ?? 0},
        ${glucotypeScore ?? 'green'}
      )
    `;
    return NextResponse.json({ id });
  } catch (error: any) {
    console.error('[meals POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
