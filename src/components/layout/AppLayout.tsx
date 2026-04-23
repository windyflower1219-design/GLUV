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

import TabLoading from '@/components/common/TabLoading';
import { useHealthData } from '@/context/HealthDataContext';

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid;
  const { isLoading: dataLoading } = useHealthData();
  const router = useRouter();
  const pathname = usePathname();
  const [showLoading, setShowLoading] = React.useState(true);
  const [isTabTransitioning, setIsTabTransitioning] = React.useState(false);

  const { 
    isOpen, 
    closeVoiceInput, 
    openVoiceInput,
    isSubmitting, 
    setIsSubmitting 
  } = useVoiceInputContext();
  
  const { saveUnifiedRecord } = useUnifiedStorage();

  // 초기 로딩 제어 및 데이터 프리패칭(Cache Priming)
  useEffect(() => {
    if (!userId) return;

    // 1. 데이터 캐시 미리 채우기
    const primeData = async () => {
      try {
        const today = new Date();
        await Promise.all([
          import('@/lib/firebase/firestore').then(m => m.getMeals(userId, today)),
          import('@/lib/firebase/firestore').then(m => m.getGlucoseReadings(userId, 48)),
          import('@/lib/firebase/firestore').then(m => m.getUserProfile(userId)),
          import('@/lib/firebase/firestore').then(m => m.getMeals(userId)),
        ]);
      } catch (err) {
        console.warn('Data priming failed:', err);
      }
    };
    primeData();

    // 2. 최소 로딩 시간 확보
    const timer = setTimeout(() => {
      setShowLoading(false);
    }, 3500); 

    return () => clearTimeout(timer);
  }, [userId]);

  // 탭 전환 시 시각적 효과 (설정 탭 전용)
  useEffect(() => {
    // 설정(프로필) 탭으로 이동할 때만 브랜드 감성을 위한 물방울 로딩 노출
    if (pathname === '/profile') {
      setIsTabTransitioning(true);
      const timer = setTimeout(() => {
        setIsTabTransitioning(false);
      }, 1200); // 1.2초간 노출
      return () => clearTimeout(timer);
    } else {
      // 대시보드, 식단 등 다른 탭은 프리페칭된 데이터로 즉시 전환
      setIsTabTransitioning(false);
    }
  }, [pathname]);

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
  const isInitialLoading = showLoading || authLoading;

  return (
    <div className="max-w-md mx-auto min-h-screen relative shadow-2xl shadow-indigo-100/20 bg-white overflow-x-hidden">
      {/* 초기 스플래시 로딩 */}
      <LoadingScreen isVisible={isInitialLoading} />

      {/* 탭 전환 로딩 (데이터 로딩 중이거나 전환 중일 때) */}
      {!isInitialLoading && <TabLoading isVisible={isTabTransitioning} />}

      {/* 메인 페이지 콘텐츠 */}
      <main className={`min-h-screen transition-all duration-500 ${isInitialLoading ? 'opacity-0' : 'opacity-100'}`}>
        {children}
      </main>

      {/* 전역 플로팅 마이크 버튼 - 로그인 페이지에선 숨김 */}
      {!isLoginPage && (
        <button
          onClick={openVoiceInput}
          className="fab-mic bg-gray-800 shadow-xl shadow-gray-200"
          aria-label="식단 또는 혈당 기록하기"
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
