/**
 * GLUV — Insights API
 *
 * GET  /api/insights              → 사용자의 영속화된 인사이트 목록 (캐시)
 * POST /api/insights              → Gemini 호출 → 새 인사이트 생성 + DB 저장
 *                                    body: { recentMeals?, averageGlucose?, force? }
 *                                    force=true면 기존 캐시 무시하고 재생성
 *
 * 캐시 정책: 4시간 이내 생성된 인사이트가 3개 이상 있으면 재호출 안 함.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sql from '@/lib/db/client';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { ensureUserExists } from '@/lib/db/helpers';

const CACHE_HOURS = 4;

function genId(prefix = 'ins') {
  const rand = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now();
  return `${prefix}_${rand}`;
}

// GET /api/insights — 캐시된 인사이트 목록
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

  try {
    const rows = await sql`
      SELECT id, type, title, message, emoji, action_label, action_url,
             linked_meal_id, is_read, created_at, expires_at
      FROM insights
      WHERE user_id = ${userId}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const insights = rows.map((r: any) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      emoji: r.emoji,
      actionLabel: r.action_label ?? undefined,
      actionUrl: r.action_url ?? undefined,
      linkedMealId: r.linked_meal_id ?? undefined,
      isRead: r.is_read,
      createdAt: r.created_at,
    }));
    return NextResponse.json({ insights });
  } catch (e: any) {
    console.error('[insights GET]', e);
    return NextResponse.json({ insights: [] });
  }
}

// POST /api/insights — Gemini 재생성 (캐시가 있으면 그대로 반환, force=true면 강제)
export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const auth = await verifyAuth(req, { fallbackUserId: body?.userId ?? null });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

  const { recentMeals, averageGlucose, force } = body || {};

  try {
    await ensureUserExists(userId);

    // 1) 캐시 확인
    if (!force) {
      const cached = await sql`
        SELECT id, type, title, message, emoji, action_label, action_url, linked_meal_id, is_read, created_at
        FROM insights
        WHERE user_id = ${userId}
          AND created_at > NOW() - (${CACHE_HOURS}::int * INTERVAL '1 hour')
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        LIMIT 5
      `;
      if (cached.length >= 3) {
        const insights = cached.map((r: any) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          message: r.message,
          emoji: r.emoji,
          actionLabel: r.action_label ?? undefined,
        }));
        return NextResponse.json({ insights, cached: true });
      }
    }

    // 2) Gemini 호출
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is missing' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' }, { apiVersion: 'v1beta' });

    const mealsText = Array.isArray(recentMeals) && recentMeals.length > 0
      ? recentMeals.join(', ')
      : '아직 식사 기록 없음';
    const glucoseText = averageGlucose && averageGlucose > 0
      ? `${averageGlucose} mg/dL`
      : '아직 혈당 기록 없음';

    const prompt = `당신은 당뇨 예방 및 혈당 관리를 돕는 GLUV 앱의 따뜻하고 다정한 건강 비서입니다.

회원님의 최근 건강 데이터:
- 평균 혈당: ${glucoseText}
- 최근 식사: ${mealsText}

위 데이터를 바탕으로 맞춤형 인사이트 3가지를 JSON 배열로만 응답해주세요. 다른 설명 없이 JSON 배열만 출력하세요.

응답 형식:
[
  {
    "id": "insight_1",
    "type": "recommendation",
    "title": "💡 제목",
    "message": "따뜻하고 다정한 존댓말로 작성된 내용. 남편/아내 등 호칭 사용 금지.",
    "emoji": "💡",
    "actionLabel": "버튼 텍스트 (선택사항)"
  }
]

type 값은 spike_alert, prediction, recommendation, achievement, warning 중 하나.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Gemini did not return valid JSON array:', text);
      return NextResponse.json({ error: 'Invalid response format from Gemini' }, { status: 500 });
    }

    const aiInsights: any[] = JSON.parse(jsonMatch[0]);

    // 3) DB 영속화 (만료: 24h)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const persisted: any[] = [];
    for (const ins of aiInsights) {
      const id = genId('ins');
      try {
        await sql`
          INSERT INTO insights (
            id, user_id, type, title, message, emoji, action_label, action_url, expires_at
          )
          VALUES (
            ${id}, ${userId},
            ${ins.type ?? 'recommendation'},
            ${ins.title ?? ''},
            ${ins.message ?? ''},
            ${ins.emoji ?? '💡'},
            ${ins.actionLabel ?? null},
            ${ins.actionUrl ?? null},
            ${expiresAt}
          )
        `;
        persisted.push({ ...ins, id });
      } catch (e) {
        console.warn('[insights persist skip]', (e as any)?.message);
        persisted.push(ins);
      }
    }

    return NextResponse.json({ insights: persisted, cached: false });
  } catch (error: any) {
    console.error('Insights API Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
