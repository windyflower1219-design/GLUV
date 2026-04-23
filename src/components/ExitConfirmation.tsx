'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LogOut } from '@/components/common/Icons';

/**
 * 뒤로가기(back gesture / 하드웨어 back) 시 종료 확인 모달을 띄우는 컴포넌트.
 * - 마운트 시 history에 sentinel state를 push하여 back 제스처가 바로 이전 URL로
 *   벗어나지 않도록 잡아둡니다.
 * - 사용자가 "종료"를 선택하면 window.close() 시도 후, 실패 시 뒤로가기를 허용해
 *   브라우저 밖으로 빠져나가게 합니다. (설치된 PWA에서는 close가 동작합니다.)
 * - "취소"를 선택하면 sentinel을 다시 push하여 다음 back 때도 모달이 뜨도록 합니다.
 *
 * 이 컴포넌트는 홈(대시보드) 페이지에서만 마운트하는 것을 권장합니다.
 */
export default function ExitConfirmation() {
  const [show, setShow] = useState(false);
  const pushingRef = useRef(false);
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pushSentinel = () => {
      try {
        pushingRef.current = true;
        window.history.pushState({ __gluvExitTrap: true }, '');
      } finally {
        pushingRef.current = false;
      }
    };

    pushSentinel();

    const handler = () => {
      if (allowLeaveRef.current) {
        // 사용자가 종료를 확정해 실제로 history를 벗어나는 케이스
        allowLeaveRef.current = false;
        return;
      }
      // back 이벤트가 들어왔다 → 모달 표시 후 sentinel 재삽입
      setShow(true);
      pushSentinel();
    };

    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
    };
  }, []);

  const handleExit = () => {
    setShow(false);
    // 1) 설치된 PWA / 스크립트로 열린 창은 close()로 닫힘
    try {
      window.close();
    } catch {
      // ignore
    }
    // 2) 일반 브라우저에서는 close가 무시됨 → 뒤로가기를 허용해 앱 바깥으로 이동
    allowLeaveRef.current = true;
    setTimeout(() => {
      try {
        window.history.go(-2); // sentinel + 이전 페이지
      } catch {
        window.history.back();
      }
    }, 50);
  };

  const handleCancel = () => {
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
    >
      <div className="w-full max-w-xs bg-white rounded-[32px] p-6 shadow-2xl border border-gray-50 animate-fade-in">
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
            <LogOut size={24} className="text-rose-500" />
          </div>
          <h3 className="text-base font-black text-gray-800 mb-1">종료하시겠습니까?</h3>
          <p className="text-xs font-bold text-gray-400 text-center mb-6">
            GLUV 앱을 종료합니다
          </p>
          <div className="flex gap-2 w-full">
            <button
              onClick={handleCancel}
              className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 text-sm font-black active:scale-95 transition-all"
            >
              취소
            </button>
            <button
              onClick={handleExit}
              className="flex-1 py-3 rounded-2xl bg-rose-500 text-white text-sm font-black active:scale-95 transition-all shadow-lg shadow-rose-100"
            >
              종료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
