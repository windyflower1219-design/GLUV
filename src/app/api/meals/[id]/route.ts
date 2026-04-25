import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';

// PATCH /api/meals/[id]  → 식단 수정
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { parsedFoods, totalCarbs, totalCalories, glucotypeScore, timestamp } = body;

    await sql`
      UPDATE meals SET
        parsed_foods    = COALESCE(${parsedFoods ? JSON.stringify(parsedFoods) + '::jsonb' : null}::jsonb, parsed_foods),
        total_carbs     = COALESCE(${totalCarbs ?? null}, total_carbs),
        total_calories  = COALESCE(${totalCalories ?? null}, total_calories),
        glucotype_score = COALESCE(${glucotypeScore ?? null}, glucotype_score),
        timestamp       = COALESCE(${timestamp ? new Date(timestamp).toISOString() : null}::timestamptz, timestamp)
      WHERE id = ${params.id}
    `;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[meals PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/meals/[id]  → 식단 삭제
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await sql`DELETE FROM meals WHERE id = ${params.id}`;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[meals DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
