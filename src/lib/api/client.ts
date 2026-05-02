/**
 * GLUV — apiFetch
 *
 * 모든 /api/* 호출에 Firebase ID Token을 자동 첨부.
 * 토큰은 Firebase Auth에서 1시간 단위로 자동 갱신된다.
 *
 * 사용법:
 *   import { apiFetch } from '@/lib/api/client';
 *   const res = await apiFetch('/api/meals', { method: 'POST', body: JSON.stringify(...) });
 *
 * 주의:
 *   - 클라이언트 컴포넌트에서만 사용. 서버 컴포넌트에선 직접 sql 사용.
 *   - 로그인 전 호출되면 토큰 없이 요청 (서버는 dev fallback 또는 401).
 */

import { auth } from '@/lib/firebase/config';

async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(/* forceRefresh */ false);
  } catch (e) {
    console.warn('[apiFetch] getIdToken failed:', (e as any)?.message);
    return null;
  }
}

export async function apiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();

  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, { ...init, headers });
}

/** 편의 메서드 — JSON 자동 파싱 */
export async function apiJson<T = any>(input: string | URL, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(input, init);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j?.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}
