'use client';

import React from 'react';
import BottomNavigation from '@/components/BottomNavigation';
import VoiceInputModal from '@/components/VoiceInputModal';
import { useVoiceInputContext } from '@/context/VoiceInputContext';
import { useUnifiedStorage } from '@/lib/hooks/useUnifiedStorage';
import { MicIcon } from '@/components/common/Icons';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { 
    isOpen, 
    closeVoiceInput, 
    openVoiceInput,
    isSubmitting, 
    setIsSubmitting 
  } = useVoiceInputContext();
  
  const { saveUnifiedRecord } = useUnifiedStorage();

  const handleConfirm = async (foods: any[], rawText: string, glucose?: any) => {
    setIsSubmitting(true);
    try {
      await saveUnifiedRecord(foods, rawText, glucose);
      // 성공 시 페이지 데이터를 새로고침하기 위해 이벤트를 발생시키거나 
      // 단순히 모달을 닫습니다. (실제 데이터 갱신은 각 페이지의 useEffect에서 처리)
      closeVoiceInput();
      
      // 페이지 자동 새로고침 유도 (간단한 방식)
      window.dispatchEvent(new CustomEvent('record-saved'));
    } catch (error) {
      alert('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen relative shadow-2xl shadow-indigo-100/20 bg-white overflow-x-hidden">
      {/* 메인 페이지 콘텐츠 */}
      <main className="min-h-screen">
        {children}
      </main>

      {/* 전역 플로팅 마이크 버튼 */}
      <button
        onClick={openVoiceInput}
        className="fab-mic bg-gray-800 shadow-xl shadow-gray-200"
        aria-label="오늘 뭐 드셨나요?"
      >
        <MicIcon size={28} className="text-white" />
      </button>

      {/* 전역 음성 입력 모달 */}
      {isOpen && (
        <VoiceInputModal
          onClose={closeVoiceInput}
          onConfirm={handleConfirm}
          isSubmitting={isSubmitting}
        />
      )}

      {/* 하단 네비게이션 */}
      <BottomNavigation />
    </div>
  );
};

export default AppLayout;
