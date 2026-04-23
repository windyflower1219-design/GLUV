'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from '@/components/common/Icons';

/**
 * GLUV 전역 뒤로가기 처리기.
 *
 * 동작 규칙:
 * 1) 열려있는 모달/편집 UI가 있으면 그 핸들러가 먼저 back 제스처를 소비한다. (LIFO)
 * 2) 소비되지 않고 현재 경로가 홈(/dashboard)이 아니면 → 홈으로 이동.
 * 3) 홈에서 back 제스처가 들어오면 → "종료하시겠습니까?" 모달.
 *    - 설치된 PWA면 window.close()
 *    - 일반 브라우저면 history.go(-1)로 앱 바깥으로 빠져나감
 *
 * 구현 포인트:
 *  - popstate에서 빠져나가지 않도록 sentinel 히스토리 state를 유지한다.
 *  - pathname이 바뀌면 sentinel을 다시 push해서 트랩을 복구한다.
 */

type BackHandler = () => boolean | void;

interface BackHandlerContextType {
  register: (handler: BackHandler) => () => void;
}

const BackHandlerContext = createContext<BackHandlerContextType>({
  register: () => () => {},
});

export const useBackHandlerContext = () => useContext(BackHandlerContext);

/**
 * 모달/편집모드 등에서 back 제스처를 가로채고 싶을 때 사용.
 * handler가 true를 반환하면 back 이벤트가 "소비"된 것으로 처리된다.
 *
 * @example
 *   useBackHandler(() => {
 *     if (isOpen) { close(); return true; }
 *     return false;
 *   }, isOpen);
 */
export const useBackHandler = (handler: BackHandler, enabled: boolean = true) => {
  const { register } = useBackHandlerContext();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const wrapped: BackHandler = () => handlerRef.current();
    const unregister = register(wrapped);
    return unregister;
  }, [enabled, register]);
};

export const BackHandlerProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();

  const handlersRef = useRef<BackHandler[]>([]);
  const pathnameRef = useRef(pathname);
  const pushingRef = useRef(false);
  const allowLeaveRef = useRef(false);

  const [showExit, setShowExit] = useState(false);
  const [isPwa, setIsPwa] = useState(false);

  // pathname 최신값을 ref로 유지 (popstate 클로저용)
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // PWA(standalone) 감지
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(display-mode: standalone)');
    const update = () => setIsPwa(mq.matches || (window.navigator as any).standalone === true);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const pushSentinel = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      pushingRef.current = true;
      window.history.pushState({ __gluvSentinel: true }, '');
    } finally {
      pushingRef.current = false;
    }
  }, []);

  // 초기 sentinel + pathname이 바뀔 때마다 trap 재설치
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 로그인 페이지에서는 trap을 걸지 않는다 (로그인 흐름은 자연스런 네비 유지)
    if (pathname === '/login') return;
    pushSentinel();
  }, [pathname, pushSentinel]);

  // popstate 감시
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPop = () => {
      if (allowLeaveRef.current) {
        allowLeaveRef.current = false;
        return;
      }

      // 1) 등록된 모달/편집 핸들러 우선 처리 (LIFO)
      const handlers = handlersRef.current;
      for (let i = handlers.length - 1; i >= 0; i--) {
        try {
          const consumed = handlers[i]();
          if (consumed) {
            pushSentinel();
            return;
          }
        } catch (err) {
          console.error('BackHandler error:', err);
        }
      }

      const current = pathnameRef.current;

      // 2) 홈이 아니면 홈으로
      if (current !== '/dashboard' && current !== '/login') {
        pushSentinel();
        router.replace('/dashboard');
        return;
      }

      // 3) 홈이면 종료 모달
      if (current === '/dashboard') {
        setShowExit(true);
        pushSentinel();
      }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [pushSentinel, router]);

  const register = useCallback((handler: BackHandler) => {
    handlersRef.current.push(handler);
    return () => {
      const idx = handlersRef.current.lastIndexOf(handler);
      if (idx >= 0) handlersRef.current.splice(idx, 1);
    };
  }, []);

  const handleExit = useCallback(() => {
    setShowExit(false);
    try {
      window.close();
    } catch {
      /* ignore */
    }
    // 일반 브라우저에서 close()가 무시되는 경우: 뒤로가기를 허용해서 빠져나간다.
    if (!isPwa) {
      allowLeaveRef.current = true;
      setTimeout(() => {
        try {
          window.history.go(-2);
        } catch {
          window.history.back();
        }
      }, 50);
    }
  }, [isPwa]);

  const handleCancelExit = useCallback(() => {
    setShowExit(false);
  }, []);

  const value = useMemo(() => ({ register }), [register]);

  return (
    <BackHandlerContext.Provider value={value}>
      {children}
      {showExit && (
        <div
          className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={(e) => e.target === e.currentTarget && handleCancelExit()}
        >
          <div className="w-full max-w-xs bg-white rounded-[32px] p-6 shadow-2xl border border-gray-50 animate-fade-in">
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
                <LogOut size={24} className="text-rose-500" />
              </div>
              <h3 className="text-base font-black text-gray-800 mb-1">종료하시겠습니까?</h3>
              <p className="text-xs font-bold text-gray-400 text-center mb-6">
                {isPwa ? 'GLUV 앱을 종료합니다' : '브라우저 앱을 닫습니다'}
              </p>
              <div className="flex gap-2 w-full">
                <button
                  onClick={handleCancelExit}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 text-sm font-black active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={handleExit}
                  className="flex-1 py-3 rounded-2xl bg-rose-500 text-white text-sm font-black active:scale-95 transition-all shadow-lg shadow-rose-100"
                >
                  {isPwa ? '종료' : '확인'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </BackHandlerContext.Provider>
  );
};
