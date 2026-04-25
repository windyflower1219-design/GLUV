import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';

// POST /api/parse-corrections  → best-effort, 실패해도 무시
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, userId, timestamp, rawVoiceInput, parsedNames, correctedNames, confidence, correctionType, source, modelUsed, recovery } = body;

    if (!rawVoiceInput?.trim()) return NextResponse.json({ ok: true });

    await sql`
      INSERT INTO parse_corrections
        (id, user_id, timestamp, raw_voice_input, parsed_names, corrected_names, confidence, correction_type, source, model_used, recovery)
      VALUES (
        ${id},
        ${userId ?? null},
        ${new Date(timestamp).toISOString()},
        ${rawVoiceInput},
        ${parsedNames ?? []}::text[],
        ${correctedNames ?? []}::text[],
        ${confidence ?? 0},
        ${correctionType},
        ${source ?? null},
        ${modelUsed ?? null},
        ${recovery ?? null}
      )
    `;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[parse-corrections POST]', error);
    return NextResponse.json({ ok: false }); // best-effort: 200 반환
  }
}
