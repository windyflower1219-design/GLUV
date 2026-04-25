import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';

// PATCH /api/glucose/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { value, measurementType, timestamp, notes } = body;

    await sql`
      UPDATE glucose_readings SET
        value            = COALESCE(${value ?? null}, value),
        measurement_type = COALESCE(${measurementType ?? null}, measurement_type),
        timestamp        = COALESCE(${timestamp ? new Date(timestamp).toISOString() : null}::timestamptz, timestamp),
        notes            = COALESCE(${notes ?? null}, notes)
      WHERE id = ${params.id}
    `;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[glucose PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/glucose/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await sql`DELETE FROM glucose_readings WHERE id = ${params.id}`;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[glucose DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
