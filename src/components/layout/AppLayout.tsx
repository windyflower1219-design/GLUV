'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BottomNavigation from '@/components/BottomNavigation';
import VoiceInputModal from '@/components/VoiceInputModal';
import { useVoiceInputContext } from '@/context/VoiceInputContext';
import { useUnifiedStorage } from '@/lib/hooks/useUnifiedStorage';
import { MicIcon } from '@/components/common/Icons';

interface AppLayoutProps {
  children: React.ReactNode;
}

import LoadingScreen from '@/components/common/LoadingScreen';

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showLoading, setShowLoading] = React.useState(true);

  const { 
    isOpen, 
    closeVoiceInput, 
    openVoiceInput,
    isSubmitting, 
    setIsSubmitting 
  } = useVoiceInputContext();
  
  const { saveUnifiedRecord } = useUnifiedStorage();

  // 초기 로딩 제어 및 프리페칭
  useEffect(() => {
    // 1. 주요 페이지 프리페칭 (성능 최적화)
    const routesToPrefetch = ['/dashboard', '/meals', '/glucose', '/insights', '/profile'];
    routesToPrefetch.forEach(route => {
      router.prefetch(route);
    });

    // 2. 최소 로딩 시간 확보 (브랜딩 및 광고 노출용)
    const timer = setTimeout(() => {
      setShowLoading(false);
    }, 2500); // 2.5초간 노출

    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (!authLoading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, authLoading, pathname, router]);

  const handleConfirm = async (foods: any[], rawText: string, glucose?: any, timestamp?: Date) => {
    setIsSubmitting(true);
    try {
      await saveUnifiedRecord(foods, rawText, glucose, timestamp);
      closeVoiceInput();
      window.dispatchEvent(new CustomEvent('record-saved'));
    } catch (error: any) {
      alert(`저장에 실패했습니다: ${error.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoginPage = pathname === '/login';
  const isLoading = showLoading || authLoading;

  return (
    <div className="max-w-md mx-auto min-h-screen relative shadow-2xl shadow-indigo-100/20 bg-white overflow-x-hidden">
      {/* 로딩 화면 */}
      <LoadingScreen isVisible={isLoading} />

      {/* 메인 페이지 콘텐츠 */}
      <main className={`min-h-screen transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {children}
      </main>

      {/* 전역 플로팅 마이크 버튼 - 로그인 페이지에선 숨김 */}
      {!isLoginPage && (
        <button
          onClick={openVoiceInput}
          className="fab-mic bg-gray-800 shadow-xl shadow-gray-200"
          aria-label="오늘 뭐 드셨나요?"
        >
          <MicIcon size={28} className="text-white" />
        </button>
      )}

      {/* 전역 음성 입력 모달 */}
      {isOpen && (
        <VoiceInputModal
          onClose={closeVoiceInput}
          onConfirm={handleConfirm}
          isSubmitting={isSubmitting}
        />
      )}

      {/* 하단 네비게이션 - 로그인 페이지에선 숨김 */}
      {!isLoginPage && <BottomNavigation />}
    </div>
  );
};

export default AppLayout;
