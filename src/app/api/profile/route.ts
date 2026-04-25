import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';

const DEFAULT_PROFILE = {
  targetKcal: 2000,
  targetGlucoseMin: 70,
  targetGlucoseMax: 140,
};

// GET /api/profile?userId=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json(DEFAULT_PROFILE);

  try {
    const rows = await sql`
      SELECT * FROM user_profiles WHERE user_id = ${userId}
    `;
    if (rows.length === 0) return NextResponse.json(DEFAULT_PROFILE);

    const row = rows[0];
    return NextResponse.json({
      targetKcal: row.target_kcal,
      targetGlucoseMin: row.target_glucose_min,
      targetGlucoseMax: row.target_glucose_max,
      updatedAt: row.updated_at,
    });
  } catch (error: any) {
    console.error('[profile GET]', error);
    return NextResponse.json(DEFAULT_PROFILE);
  }
}

// PATCH /api/profile  → upsert
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, targetKcal, targetGlucoseMin, targetGlucoseMax } = body;
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    await sql`
      INSERT INTO user_profiles (user_id, target_kcal, target_glucose_min, target_glucose_max, updated_at)
      VALUES (
        ${userId},
        ${targetKcal ?? DEFAULT_PROFILE.targetKcal},
        ${targetGlucoseMin ?? DEFAULT_PROFILE.targetGlucoseMin},
        ${targetGlucoseMax ?? DEFAULT_PROFILE.targetGlucoseMax},
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        target_kcal        = EXCLUDED.target_kcal,
        target_glucose_min = EXCLUDED.target_glucose_min,
        target_glucose_max = EXCLUDED.target_glucose_max,
        updated_at         = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[profile PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
