'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BottomNavigation from '@/components/BottomNavigation';
import VoiceInputModal from '@/components/VoiceInputModal';
import { useVoiceInputContext } from '@/context/VoiceInputContext';
import { useUnifiedStorage } from '@/lib/hooks/useUnifiedStorage';
import { useHealthData } from '@/context/HealthDataContext';
import { MicIcon } from '@/components/common/Icons';
import type { FoodItem, MeasurementType } from '@/types';

import LoadingScreen from '@/components/common/LoadingScreen';
import TabLoading from '@/components/common/TabLoading';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid;
  const { refreshData } = useHealthData();
  const router = useRouter();
  const pathname = usePathname();
  const [showLoading, setShowLoading] = React.useState(true);
  const [isTabTransitioning, setIsTabTransitioning] = React.useState(false);

  const { isOpen, closeVoiceInput, openVoiceInput, isSubmitting, setIsSubmitting } =
    useVoiceInputContext();

  const { saveUnifiedRecord } = useUnifiedStorage();

  // 최소 스플래시 시간 (브랜드 감성)
  // userId 유무와 무관하게 항상 타이머를 돌려야 비로그인 사용자도 로그인 화면으로 넘어갈 수 있다.
  // 실제 가시성은 isInitialLoading = showLoading || authLoading 으로 제어됨.
  useEffect(() => {
    const timer = setTimeout(() => setShowLoading(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  // 설정 탭 전환 시 로딩 효과
  useEffect(() => {
    if (pathname === '/profile') {
      setIsTabTransitioning(true);
      const timer = setTimeout(() => setIsTabTransitioning(false), 1200);
      return () => clearTimeout(timer);
    } else {
      setIsTabTransitioning(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!authLoading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, authLoading, pathname, router]);

  // VoiceInputModal에서 파싱 완료 후 호출됨
  // foods: Gemini가 추출한 식품 목록, rawText: 원문, glucose: 혈당값, timestamp: 측정시각
  const handleConfirm = async (
    foods: FoodItem[],
    rawText: string,
    glucose?: { value: number; type: MeasurementType },
    timestamp?: Date,
  ) => {
    setIsSubmitting(true);
    try {
      await saveUnifiedRecord(foods, rawText, glucose, timestamp);
      closeVoiceInput();
      await refreshData(); // 저장 후 컨텍스트 갱신 (이벤트 버스 없이 직접 호출)
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
      <LoadingScreen isVisible={isInitialLoading} />

      {!isInitialLoading && <TabLoading isVisible={isTabTransitioning} />}

      <main
        className={`min-h-screen transition-all duration-500 ${isInitialLoading ? 'opacity-0' : 'opacity-100'}`}
      >
        {children}
      </main>

      {!isLoginPage && !pathname.startsWith('/admin') && (
        <div className="fixed bottom-[100px] right-6 z-50">
          <button
            onClick={openVoiceInput}
            className="fab-mic-new group"
            aria-label="식단 또는 혈당 기록하기"
          >
            <MicIcon size={24} className="text-white group-hover:scale-110 transition-transform" />
          </button>
        </div>
      )}

      {isOpen && (
        <VoiceInputModal
          onClose={closeVoiceInput}
          onConfirm={handleConfirm}
          isSubmitting={isSubmitting}
        />
      )}

      {!isLoginPage && <BottomNavigation />}
    </div>
  );
};

export default AppLayout;
