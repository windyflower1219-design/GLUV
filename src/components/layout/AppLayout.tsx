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
  const [dataPrimed, setDataPrimed] = React.useState(false);

  // 초기 로딩 제어 및 데이터 프리패칭(Cache Priming)
  useEffect(() => {
    if (!userId) return;

    // 1. 주요 페이지 코드 프리페칭
    const routesToPrefetch = ['/dashboard', '/meals', '/glucose', '/insights', '/profile'];
    routesToPrefetch.forEach(route => {
      router.prefetch(route);
    });

    // 2. 데이터 캐시 미리 채우기 (Cache Priming)
    // 로딩 화면이 떠 있는 동안 백그라운드에서 미리 데이터를 가져와 firestore.ts의 READ_CACHE에 저장합니다.
    const primeData = async () => {
      try {
        const today = new Date();
        await Promise.all([
          import('@/lib/firebase/firestore').then(m => m.getMeals(userId, today)),
          import('@/lib/firebase/firestore').then(m => m.getGlucoseReadings(userId, 48)),
          import('@/lib/firebase/firestore').then(m => m.getUserProfile(userId)),
          import('@/lib/firebase/firestore').then(m => m.getMeals(userId)), // 히스토리용
        ]);
        setDataPrimed(true);
      } catch (err) {
        console.warn('Data priming failed:', err);
      }
    };

    primeData();

    // 3. 최소 로딩 시간 확보 (3.5초로 연장하여 더 세밀한 데이터 준비)
    const timer = setTimeout(() => {
      setShowLoading(false);
    }, 3500); 

    return () => clearTimeout(timer);
  }, [router, userId]);

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
