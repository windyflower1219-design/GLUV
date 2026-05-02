import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';
import { verifyAuth } from '@/lib/auth/verifyAuth';

// POST /api/parse-corrections  → best-effort, 실패해도 무시
export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}

  // 학습 로그라 익명도 허용 — 단, 토큰이 있으면 그 uid 사용.
  const auth = await verifyAuth(req, { fallbackUserId: body?.userId ?? null });
  // 인증 실패해도 학습은 익명으로 저장 (단, dev fallback이 아니면 401만 그대로 반환)
  let userId: string | null = null;
  if (auth.ok) userId = auth.userId;

  try {
    const { id, timestamp, rawVoiceInput, parsedNames, correctedNames, confidence, correctionType, source, modelUsed, recovery } = body || {};

    if (!rawVoiceInput?.trim()) return NextResponse.json({ ok: true });

    await sql`
      INSERT INTO parse_corrections
        (id, user_id, timestamp, raw_voice_input, parsed_names, corrected_names, confidence, correction_type, source, model_used, recovery)
      VALUES (
        ${id},
        ${userId},
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
    return NextResponse.json({ ok: false });
  }
}
