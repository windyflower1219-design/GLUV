import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { ensureUserExists, scheduleImpactRecompute } from '@/lib/db/helpers';

// GET /api/glucose?hours=168  → 최근 N시간 혈당
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

  const hours = parseInt(req.nextUrl.searchParams.get('hours') || '24');

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
  let body: any = {};
  try { body = await req.json(); } catch {}
  const auth = await verifyAuth(req, { fallbackUserId: body?.userId ?? null });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

  try {
    const { id, timestamp, value, measurementType, linkedMealId, notes } = body || {};

    // FK 무결성: users 행 보장
    await ensureUserExists(userId);

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

    // 연결된 식사가 있으면 영향 캐시 비동기 갱신
    if (linkedMealId) scheduleImpactRecompute(userId, linkedMealId);

    return NextResponse.json({ id });
  } catch (error: any) {
    console.error('[glucose POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
