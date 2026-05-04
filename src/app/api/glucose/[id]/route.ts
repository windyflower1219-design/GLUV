import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';
import { verifyAuth } from '@/lib/auth/verifyAuth';

type Ctx = { params: Promise<{ id: string }> };

async function resolveId(ctx: Ctx) {
  const p = await ctx.params;
  return p.id;
}

// PATCH /api/glucose/[id] — 본인 row만 수정
export async function PATCH(req: NextRequest, ctx: Ctx) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const auth = await verifyAuth(req, { fallbackUserId: body?.userId ?? null });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = await resolveId(ctx);

  try {
    const { value, measurementType, timestamp, notes } = body || {};
    const result = await sql`
      UPDATE glucose_readings SET
        value            = COALESCE(${value ?? null}, value),
        measurement_type = COALESCE(${measurementType ?? null}, measurement_type),
        timestamp        = COALESCE(${timestamp ? new Date(timestamp).toISOString() : null}::timestamptz, timestamp),
        notes            = COALESCE(${notes ?? null}, notes)
      WHERE id = ${id} AND user_id = ${auth.userId}
      RETURNING id
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'not found or forbidden' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[glucose PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/glucose/[id]
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = await resolveId(ctx);

  try {
    const result = await sql`
      DELETE FROM glucose_readings
      WHERE id = ${id} AND user_id = ${auth.userId}
      RETURNING id
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'not found or forbidden' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[glucose DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
