import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';
import { verifyAuth } from '@/lib/auth/verifyAuth';

const DEFAULT_PROFILE = {
  targetKcal: 2000,
  targetGlucoseMin: 70,
  targetGlucoseMax: 140,
};

// GET /api/profile  → Authorization 헤더의 uid 기준 (없으면 ?userId 폴백 — dev only)
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

  try {
    const rows = await sql`
      SELECT * FROM user_profiles WHERE user_id = ${userId}
    `;
    if (rows.length === 0) return NextResponse.json(DEFAULT_PROFILE);

    const row = rows[0] as any;
    return NextResponse.json({
      targetKcal: row.target_kcal,
      targetGlucoseMin: row.target_glucose_min,
      targetGlucoseMax: row.target_glucose_max,
      name: row.name ?? null,
      email: row.email ?? null,
      diabetesType: row.diabetes_type ?? null,
      weight: row.weight !== null && row.weight !== undefined ? Number(row.weight) : null,
      height: row.height !== null && row.height !== undefined ? Number(row.height) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error: any) {
    console.error('[profile GET]', error);
    return NextResponse.json(DEFAULT_PROFILE);
  }
}

// PATCH /api/profile  → upsert
export async function PATCH(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const auth = await verifyAuth(req, { fallbackUserId: body?.userId ?? null });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

  try {
    const {
      targetKcal,
      targetGlucoseMin,
      targetGlucoseMax,
      name,
      email,
      diabetesType,
      weight,
      height,
    } = body || {};

    await sql`
      INSERT INTO user_profiles (
        user_id, target_kcal, target_glucose_min, target_glucose_max,
        name, email, diabetes_type, weight, height, updated_at
      )
      VALUES (
        ${userId},
        ${targetKcal ?? DEFAULT_PROFILE.targetKcal},
        ${targetGlucoseMin ?? DEFAULT_PROFILE.targetGlucoseMin},
        ${targetGlucoseMax ?? DEFAULT_PROFILE.targetGlucoseMax},
        ${name ?? null},
        ${email ?? null},
        ${diabetesType ?? null},
        ${weight ?? null},
        ${height ?? null},
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        target_kcal        = COALESCE(${targetKcal ?? null},       user_profiles.target_kcal),
        target_glucose_min = COALESCE(${targetGlucoseMin ?? null}, user_profiles.target_glucose_min),
        target_glucose_max = COALESCE(${targetGlucoseMax ?? null}, user_profiles.target_glucose_max),
        name               = COALESCE(${name ?? null},             user_profiles.name),
        email              = COALESCE(${email ?? null},            user_profiles.email),
        diabetes_type      = COALESCE(${diabetesType ?? null},     user_profiles.diabetes_type),
        weight             = COALESCE(${weight ?? null},           user_profiles.weight),
        height             = COALESCE(${height ?? null},           user_profiles.height),
        updated_at         = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[profile PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
