/**
 * GLUV — verifyAuth 헬퍼
 *
 * 모든 API 라우트에서 호출:
 *   const { ok, userId, status, error } = await verifyAuth(req);
 *   if (!ok) return NextResponse.json({ error }, { status });
 *
 * 동작:
 *  - Authorization: Bearer <ID_TOKEN> 헤더에서 ID Token 추출
 *  - firebase-admin 으로 검증 → uid 반환
 *  - firebase-admin 미설정(dev) 환경에서는 query/body의 userId를 그대로 신뢰 (fallback)
 *
 * 보안:
 *  - 운영에서는 반드시 FIREBASE_ADMIN_* 환경변수 3개 설정 필요.
 *  - 미설정 시 콘솔에 경고가 출력됨.
 */

import type { NextRequest } from 'next/server';
import { getAdminAuth, isAdminConfigured } from '@/lib/firebase/admin';

export type VerifyResult =
  | { ok: true; userId: string; via: 'token' | 'fallback' }
  | { ok: false; status: number; error: string };

/** 헤더에서 Bearer 토큰 꺼내기 */
function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * JWT의 payload만 base64 디코드해서 uid 추출 (서명 검증 없음).
 * dev 모드에서 firebase-admin이 미설정일 때만 사용.
 */
function unsafeDecodeJwtUid(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // base64url → base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const json = typeof atob === 'function'
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('utf-8');
    const claims = JSON.parse(json);
    return claims?.user_id || claims?.sub || null;
  } catch {
    return null;
  }
}

/**
 * 요청 인증.
 * - 토큰이 있으면 검증해서 uid 반환.
 * - 토큰이 없고 admin이 설정되어 있으면 401.
 * - admin이 미설정(dev)이면 query/body의 userId 폴백 허용.
 */
export async function verifyAuth(req: NextRequest, opts?: {
  /** body에서 userId를 꺼내는 헬퍼. 폴백 모드에서만 사용됨. */
  fallbackUserId?: string | null;
}): Promise<VerifyResult> {
  const token = extractBearer(req);

  if (token) {
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        return { ok: true, userId: decoded.uid, via: 'token' };
      } catch (e: any) {
        return { ok: false, status: 401, error: 'invalid token' };
      }
    }
    // admin 미설정(dev) — JWT payload에서 uid만 추출 (서명 검증 없음)
    const uidFromToken = unsafeDecodeJwtUid(token);
    if (uidFromToken) {
      return { ok: true, userId: uidFromToken, via: 'fallback' };
    }
    const fallback =
      opts?.fallbackUserId ??
      req.nextUrl.searchParams.get('userId') ??
      null;
    if (fallback) {
      return { ok: true, userId: fallback, via: 'fallback' };
    }
    return { ok: false, status: 503, error: 'auth not configured on server' };
  }

  // 토큰이 없는 경우
  if (isAdminConfigured()) {
    return { ok: false, status: 401, error: 'missing Authorization header' };
  }

  // dev fallback: 클라이언트가 보낸 userId 신뢰
  const fallback =
    opts?.fallbackUserId ??
    req.nextUrl.searchParams.get('userId') ??
    null;

  if (!fallback) {
    return { ok: false, status: 400, error: 'userId required (dev fallback)' };
  }
  return { ok: true, userId: fallback, via: 'fallback' };
}
