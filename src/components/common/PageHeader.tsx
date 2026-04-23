'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Loader2 } from './Icons';
import { useAuth } from '@/context/AuthContext';
import { useBackHandler } from '@/context/BackHandlerContext';

interface PageHeaderProps {
  title: string;
  showBranding?: boolean;
  subtitle?: string;
  rightElement?: React.ReactNode;
  /** 로그아웃 버튼 노출 여부 (기본: true) */
  showLogout?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title, showBranding = false, subtitle, rightElement, showLogout = true,
}) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // 로그아웃 모달 열려있을 때 back 제스처 처리: 먼저 모달만 닫힘
  useBackHandler(() => {
    if (confirmOpen && !loggingOut) {
      setConfirmOpen(false);
      return true;
    }
    return false;
  }, confirmOpen);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.push('/login');
    } catch (err: any) {
      alert(`로그아웃에 실패했습니다: ${err?.message || err}`);
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  };

  return (
    <header className="safe-top px-6 pt-6 pb-2 sticky top-0 bg-[var(--color-bg-primary)]/90 backdrop-blur-xl z-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBranding ? (
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <h1 className="text-2xl font-black text-gray-800 tracking-tighter">GLUV</h1>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-400 leading-none">Glucose + View</span>
                  <span className="text-[7px] font-medium text-rose-300 leading-none mt-1 uppercase tracking-tighter">for YR Lee</span>
                </div>
              </div>
              {subtitle && <p className="text-xs font-bold text-gray-400 mt-1">{subtitle} 👋</p>}
            </div>
          ) : (
            <div>
              <h1 className="text-xl font-black text-gray-800">{title}</h1>
              {subtitle && <p className="text-[10px] font-bold text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {rightElement || (
            <Link href="/insights" className="relative w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-gray-50 active:scale-90 transition-all">
              <Bell size={20} className="text-gray-400" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            </Link>
          )}

          {showLogout && user && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-gray-50 active:scale-90 transition-all"
              aria-label="로그아웃"
              title="로그아웃"
            >
              <LogOut size={18} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* 로그아웃 확인 모달 */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6"
          onClick={(e) => e.target === e.currentTarget && !loggingOut && setConfirmOpen(false)}
        >
          <div className="w-full max-w-xs bg-white rounded-[32px] p-6 shadow-2xl border border-gray-50">
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
                <LogOut size={24} className="text-rose-500" />
              </div>
              <h3 className="text-base font-black text-gray-800 mb-1">로그아웃 하시겠어요?</h3>
              <p className="text-xs font-bold text-gray-400 text-center mb-6">
                {user?.email ? `${user.email}` : '계정'}에서 로그아웃됩니다
              </p>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setConfirmOpen(false)}
                  disabled={loggingOut}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 text-sm font-black active:scale-95 transition-all disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex-1 py-3 rounded-2xl bg-rose-500 text-white text-sm font-black active:scale-95 transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loggingOut && <Loader2 size={14} className="animate-spin" />}
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default PageHeader;
