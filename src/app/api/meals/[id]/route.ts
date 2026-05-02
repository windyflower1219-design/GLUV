import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { sumNutrients, scheduleImpactRecompute } from '@/lib/db/helpers';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function resolveId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params as any);
  return p.id as string;
}

// PATCH /api/meals/[id]  → 식단 수정 (본인만)
export async function PATCH(req: NextRequest, ctx: Ctx) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const auth = await verifyAuth(req, { fallbackUserId: body?.userId ?? null });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = await resolveId(ctx);

  try {
    const { parsedFoods, totalCarbs, totalCalories, totalProtein, totalFat, totalSodium, glucotypeScore, timestamp, notes, imageUrl } = body || {};

    // parsedFoods가 들어오면 영양소 합계 자동 재계산 (클라이언트 누락 대비)
    const auto = parsedFoods ? sumNutrients(parsedFoods) : null;

    const result = await sql`
      UPDATE meals SET
        parsed_foods    = COALESCE(${parsedFoods ? JSON.stringify(parsedFoods) : null}::jsonb, parsed_foods),
        total_carbs     = COALESCE(${totalCarbs ?? auto?.carbs ?? null},       total_carbs),
        total_calories  = COALESCE(${totalCalories ?? auto?.calories ?? null}, total_calories),
        total_protein   = COALESCE(${totalProtein ?? auto?.protein ?? null},   total_protein),
        total_fat       = COALESCE(${totalFat ?? auto?.fat ?? null},           total_fat),
        total_sodium    = COALESCE(${totalSodium ?? auto?.sodium ?? null},     total_sodium),
        glucotype_score = COALESCE(${glucotypeScore ?? null}, glucotype_score),
        timestamp       = COALESCE(${timestamp ? new Date(timestamp).toISOString() : null}::timestamptz, timestamp),
        notes           = COALESCE(${notes ?? null}, notes),
        image_url       = COALESCE(${imageUrl ?? null}, image_url)
      WHERE id = ${id} AND user_id = ${auth.userId}
      RETURNING id
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'not found or forbidden' }, { status: 404 });
    }

    // 영향 캐시 갱신
    scheduleImpactRecompute(auth.userId, id);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[meals PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/meals/[id]
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = await resolveId(ctx);

  try {
    const result = await sql`
      DELETE FROM meals
      WHERE id = ${id} AND user_id = ${auth.userId}
      RETURNING id
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'not found or forbidden' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[meals DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
