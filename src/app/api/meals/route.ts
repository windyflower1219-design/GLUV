import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { ensureUserExists, sumNutrients, upsertFoodDictionary, scheduleImpactRecompute } from '@/lib/db/helpers';

// GET /api/meals?date=YYYY-MM-DD  또는 ?days=30
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

  const { searchParams } = req.nextUrl;
  const date = searchParams.get('date');
  const days = searchParams.get('days');

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
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/meals  → 식단 저장
export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const auth = await verifyAuth(req, { fallbackUserId: body?.userId ?? null });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

  try {
    const {
      id, timestamp, mealType, rawVoiceInput,
      parsedFoods, glucotypeScore,
      totalCarbs, totalCalories, totalProtein, totalFat, totalSodium,
      imageUrl, notes,
    } = body || {};

    // FK 무결성: users 행 보장
    await ensureUserExists(userId);

    // 영양소 합계: 클라이언트가 보낸 값 우선, 없으면 parsedFoods로 자동 합산
    const auto = sumNutrients(parsedFoods ?? []);

    await sql`
      INSERT INTO meals (
        id, user_id, timestamp, meal_type, raw_voice_input, parsed_foods,
        total_carbs, total_calories, total_protein, total_fat, total_sodium,
        glucotype_score, image_url, notes
      )
      VALUES (
        ${id},
        ${userId},
        ${new Date(timestamp).toISOString()},
        ${mealType},
        ${rawVoiceInput ?? ''},
        ${JSON.stringify(parsedFoods ?? [])}::jsonb,
        ${totalCarbs    ?? auto.carbs},
        ${totalCalories ?? auto.calories},
        ${totalProtein  ?? auto.protein},
        ${totalFat      ?? auto.fat},
        ${totalSodium   ?? auto.sodium},
        ${glucotypeScore ?? 'green'},
        ${imageUrl ?? null},
        ${notes ?? null}
      )
    `;

    // 음식 사전 학습 (best-effort)
    upsertFoodDictionary(userId, parsedFoods ?? []).catch(() => {});

    // 혈당 영향 캐시 (식사 등록 직후엔 데이터 부족 — 비동기로 시도)
    scheduleImpactRecompute(userId, id);

    return NextResponse.json({ id });
  } catch (error: any) {
    console.error('[meals POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
