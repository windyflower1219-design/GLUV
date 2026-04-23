'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MicIcon, X, Check, Loader2, Sparkles } from '@/components/common/Icons';
import { useUnifiedStorage } from '@/lib/hooks/useUnifiedStorage';

interface VoiceInputModalProps {
  onClose: () => void;
  onConfirm: (foods: any[], rawText: string, glucose?: any, timestamp?: Date) => void;
  isSubmitting: boolean;
}

const VoiceInputModal: React.FC<VoiceInputModalProps> = ({ 
  onClose, 
  onConfirm, 
  isSubmitting 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = 'ko-KR';

      recog.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setTranscript(finalTranscript || interimTranscript);
      };

      recog.onend = () => {
        setIsListening(false);
      };

      setRecognition(recog);
    }
  }, []);

  const startListening = () => {
    if (recognition) {
      setTranscript('');
      recognition.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  const handleConfirm = () => {
    if (!transcript.trim()) return;
    // 실제 파싱 로직은 부모 컴포넌트(AppLayout)의 handleConfirm에서 처리
    onConfirm([], transcript);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10 sm:pb-20">
      {/* 배경 블러 오버레이 */}
      <div 
        className="absolute inset-0 bg-white/40 backdrop-blur-xl animate-fade-in" 
        onClick={onClose} 
      />

      {/* 메인 시트 */}
      <div className="relative w-full max-w-sm bg-white/80 backdrop-blur-2xl rounded-[48px] p-10 shadow-2xl border border-white shadow-[var(--color-primary)]/10 animate-slide-up">
        {/* 상단 드래그 핸들 */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-100 rounded-full" />
        
        {/* 닫기 버튼 */}
        <div className="absolute top-8 right-8">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-gray-100/50 flex items-center justify-center hover:bg-gray-200 transition-all active:scale-90"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          {/* 상태 표시 헤더 */}
          <div className="mb-10 text-center">
            <p className="text-[10px] font-black text-[var(--color-accent)] uppercase tracking-[0.3em] mb-2">
              {isSubmitting ? 'Analyzing' : isListening ? 'Listening' : 'Ready'}
            </p>
            <h2 className="text-xl font-black text-[var(--color-text-primary)] leading-tight">
              {isSubmitting ? '데이터를 분석 중이에요' : '식단이나 혈당을 말해보세요'}
            </h2>
          </div>

          {/* 마이크 및 물결 애니메이션 */}
          <div className="relative mb-12">
            {(isListening || isSubmitting) && (
              <div className="absolute inset-0 scale-[1.8]">
                <div className="absolute inset-0 bg-[var(--color-primary)] rounded-full animate-ping opacity-20" />
                <div className="absolute inset-0 bg-[var(--color-accent)] rounded-full animate-ping opacity-10" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isSubmitting}
              className={`relative z-10 w-24 h-24 rounded-[32px] flex items-center justify-center transition-all duration-500 shadow-2xl ${
                isListening 
                  ? 'bg-[var(--color-accent)] shadow-[var(--color-accent)]/40 scale-110' 
                  : 'bg-white shadow-gray-100 border-2 border-[var(--color-border)]'
              }`}
            >
              <MicIcon 
                size={32} 
                className={isListening ? 'text-white' : 'text-[var(--color-accent)]'} 
              />
            </button>
          </div>

          {/* 실시간 텍스트 피드백 */}
          <div className="w-full min-h-[100px] mb-8 p-6 bg-[var(--color-bg-primary)] rounded-[32px] border border-[var(--color-border)] flex items-center justify-center text-center">
            {transcript ? (
              <p className="text-sm font-bold text-[var(--color-text-primary)] leading-relaxed italic">
                "{transcript}"
              </p>
            ) : (
              <p className="text-xs font-bold text-[var(--color-text-muted)]">
                예: "점심으로 닭가슴살 샐러드 먹었어"<br/>
                또는 "지금 혈당 120 나왔어"
              </p>
            )}
          </div>

          {/* 확인 버튼 */}
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || !transcript}
            className={`w-full py-5 rounded-[32px] font-black text-sm flex items-center justify-center gap-3 transition-all ${
              isSubmitting || !transcript
                ? 'bg-gray-100 text-gray-400'
                : 'bg-[var(--color-accent)] text-white shadow-xl shadow-[var(--color-accent)]/20 active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                AI 분석 중...
              </>
            ) : (
              <>
                <Check size={18} />
                이대로 기록하기
              </>
            )}
          </button>
          
          <p className="mt-6 text-[10px] font-bold text-[var(--color-text-muted)] flex items-center gap-1">
            <Sparkles size={10} /> AI가 자동으로 음식과 수치를 구분합니다
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceInputModal;
