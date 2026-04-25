import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';

// GET /api/glucose?userId=xxx&hours=168  → 최근 N시간 혈당
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get('userId');
  const hours = parseInt(searchParams.get('hours') || '24');

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  try {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    const rows = await sql`
      SELECT * FROM glucose_readings
      WHERE user_id = ${userId}
        AND timestamp >= ${cutoff.toISOString()}
      ORDER BY timestamp ASC
    `;
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('[glucose GET]', error);
    return NextResponse.json([]);
  }
}

// POST /api/glucose  → 혈당 저장, { id } 반환
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, userId, timestamp, value, measurementType, linkedMealId, notes } = body;

    await sql`
      INSERT INTO glucose_readings (id, user_id, timestamp, value, measurement_type, linked_meal_id, notes)
      VALUES (
        ${id},
        ${userId},
        ${new Date(timestamp).toISOString()},
        ${value},
        ${measurementType},
        ${linkedMealId ?? null},
        ${notes ?? null}
      )
    `;
    return NextResponse.json({ id });
  } catch (error: any) {
    console.error('[glucose POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
