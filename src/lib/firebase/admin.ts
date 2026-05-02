/**
 * GLUV — Firebase Admin SDK (서버 전용)
 *
 * 사용처:
 *  - API 라우트에서 ID Token 검증 (verifyAuth)
 *
 * 환경변수:
 *  - FIREBASE_ADMIN_PROJECT_ID
 *  - FIREBASE_ADMIN_CLIENT_EMAIL
 *  - FIREBASE_ADMIN_PRIVATE_KEY  (\n 이스케이프 자동 복원)
 *
 * 동작:
 *  - 위 3개가 모두 설정된 경우에만 초기화. 누락 시 verifyAuth가 dev-fallback 모드로 동작.
 *  - HMR/서버리스 환경에서 중복 init 방지.
 */

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App | null = null;
let initAttempted = false;

function tryInitAdmin(): App | null {
  if (initAttempted) return adminApp;
  initAttempted = true;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[firebase-admin] credentials missing — verifyAuth will run in dev-fallback (trust client userId).'
      );
    }
    return null;
  }

  // Vercel/.env에서 \n 으로 인코딩된 줄바꿈 복원
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  try {
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    return adminApp;
  } catch (e) {
    console.error('[firebase-admin] init failed:', e);
    return null;
  }
}

export function getAdminAuth() {
  const app = tryInitAdmin();
  if (!app) return null;
  return getAuth(app);
}

export function isAdminConfigured(): boolean {
  return tryInitAdmin() !== null;
}
