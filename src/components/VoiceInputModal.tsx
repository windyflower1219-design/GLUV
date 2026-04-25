'use client';

import React, { useState, useEffect } from 'react';
import { MicIcon, X, Check, Loader2, Sparkles } from '@/components/common/Icons';
import type { FoodItem, MeasurementType } from '@/types';

interface ParsedResult {
  parsedFoods: FoodItem[];
  glucoseValue?: number;
  detectedMeasType?: string;
  detectedTime?: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

interface VoiceInputModalProps {
  onClose: () => void;
  onConfirm: (
    foods: FoodItem[],
    rawText: string,
    glucose?: { value: number; type: MeasurementType },
    timestamp?: Date,
  ) => void;
  isSubmitting: boolean;
}

const MEAS_TYPE_LABELS: Record<string, string> = {
  fasting: '공복',
  postmeal_30m: '식후 30분',
  postmeal_1h: '식후 1시간',
  postmeal_2h: '식후 2시간',
  random: '임의 측정',
};

function parseDetectedTime(timeStr: string): Date {
  const parts = timeStr.split(':').map(Number);
  const now = new Date();
  if (!isNaN(parts[0])) now.setHours(parts[0], isNaN(parts[1]) ? 0 : parts[1], 0, 0);
  return now;
}

type Step = 'input' | 'parsing' | 'preview';

const VoiceInputModal: React.FC<VoiceInputModalProps> = ({ onClose, onConfirm, isSubmitting }) => {
  const [step, setStep] = useState<Step>('input');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'ko-KR';
    recog.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      setTranscript(final || interim);
    };
    recog.onend = () => setIsListening(false);
    setRecognition(recog);
  }, []);

  const startListening = () => {
    if (!recognition) return;
    setTranscript('');
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognition?.stop();
    setIsListening(false);
  };

  // Step 1 → Step 2: Gemini 파싱 요청
  const handleParse = async () => {
    if (!transcript.trim()) return;
    setStep('parsing');
    setParseError(null);
    try {
      const res = await fetch('/api/parse-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceText: transcript }),
      });
      const data: ParsedResult = await res.json();
      setParsedResult(data);
      setStep('preview');
    } catch {
      setParseError('AI 분석에 실패했습니다. 다시 시도해주세요.');
      setStep('input');
    }
  };

  // Step 3: 실제 저장 — 파싱된 데이터를 부모로 전달
  const handleSave = () => {
    if (!parsedResult) return;
    const glucose =
      parsedResult.glucoseValue != null
        ? {
            value: parsedResult.glucoseValue,
            type: (parsedResult.detectedMeasType || 'random') as MeasurementType,
          }
        : undefined;
    const timestamp = parsedResult.detectedTime
      ? parseDetectedTime(parsedResult.detectedTime)
      : new Date();
    onConfirm(parsedResult.parsedFoods ?? [], transcript, glucose, timestamp);
  };

  const handleReRecord = () => {
    setStep('input');
    setTranscript('');
    setParsedResult(null);
    setParseError(null);
  };

  const hasFoods = (parsedResult?.parsedFoods?.length ?? 0) > 0;
  const hasGlucose = parsedResult?.glucoseValue != null;

  // ── parsing 중 ──────────────────────────────────────────────────────────────
  if (step === 'parsing') {
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10 sm:pb-20">
        <div className="absolute inset-0 bg-white/40 backdrop-blur-xl animate-fade-in" />
        <div className="relative w-full max-w-sm bg-white/80 backdrop-blur-2xl rounded-[48px] p-10 shadow-2xl border border-white animate-slide-up">
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="relative">
              <div className="absolute inset-0 scale-[2] bg-[var(--color-primary)] rounded-full animate-ping opacity-10" />
              <Loader2 size={48} className="relative animate-spin text-[var(--color-accent)]" />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-[var(--color-accent)] uppercase tracking-[0.3em] mb-2">
                Analyzing
              </p>
              <p className="text-lg font-black text-[var(--color-text-primary)]">AI가 분석 중이에요</p>
            </div>
            <p className="text-xs font-bold text-[var(--color-text-muted)] italic text-center max-w-[220px]">
              "{transcript}"
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── 미리보기 (저장 전 확인) ─────────────────────────────────────────────────
  if (step === 'preview') {
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10 sm:pb-20">
        <div className="absolute inset-0 bg-white/40 backdrop-blur-xl animate-fade-in" />
        <div className="relative w-full max-w-sm bg-white/80 backdrop-blur-2xl rounded-[48px] p-8 shadow-2xl border border-white animate-slide-up max-h-[90vh] overflow-y-auto">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-100 rounded-full" />

          <div className="flex items-center justify-between mt-2 mb-6">
            <button
              onClick={handleReRecord}
              className="text-xs font-bold text-gray-400 active:scale-95 transition-all"
            >
              ← 다시 말하기
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-100/50 flex items-center justify-center"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          <p className="text-[10px] font-black text-[var(--color-accent)] uppercase tracking-widest mb-1">
            AI 분석 결과
          </p>
          <p className="text-xs font-bold text-gray-400 italic mb-5 leading-relaxed">
            "{transcript}"
          </p>

          {parsedResult?.needsClarification && !hasFoods && !hasGlucose ? (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mb-5">
              <p className="text-xs font-bold text-amber-700 leading-relaxed">
                {parsedResult.clarificationQuestion ||
                  '음식이나 혈당을 인식하지 못했어요. 더 구체적으로 말씀해 주세요.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 mb-5">
              {hasFoods && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    🍽 식단
                  </p>
                  {parsedResult!.parsedFoods.map((food, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-black text-gray-800">{food.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {food.quantity}
                          {food.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-gray-600">{food.calories} kcal</p>
                        <p className="text-[10px] text-gray-400">탄수 {food.carbs}g</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasGlucose && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      💉 혈당
                    </p>
                    <p className="text-sm font-black text-gray-800">
                      {MEAS_TYPE_LABELS[parsedResult!.detectedMeasType || 'random'] || '임의 측정'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[var(--color-accent)]">
                      {parsedResult!.glucoseValue}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400">mg/dL</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReRecord}
              className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-[28px] font-black text-sm active:scale-95 transition-all"
            >
              다시 말하기
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting || (!hasFoods && !hasGlucose)}
              className={`flex-[2] py-4 rounded-[28px] font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all ${
                isSubmitting || (!hasFoods && !hasGlucose)
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-[var(--color-accent)] text-white shadow-xl shadow-[var(--color-accent)]/20'
              }`}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              저장하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 입력 단계 (기본) ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10 sm:pb-20">
      <div
        className="absolute inset-0 bg-white/40 backdrop-blur-xl animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-white/80 backdrop-blur-2xl rounded-[48px] p-10 shadow-2xl border border-white shadow-[var(--color-primary)]/10 animate-slide-up">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-100 rounded-full" />
        <div className="absolute top-8 right-8">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-gray-100/50 flex items-center justify-center hover:bg-gray-200 transition-all active:scale-90"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="mb-10 text-center">
            <p className="text-[10px] font-black text-[var(--color-accent)] uppercase tracking-[0.3em] mb-2">
              {isListening ? 'Listening' : 'Ready'}
            </p>
            <h2 className="text-xl font-black text-[var(--color-text-primary)] leading-tight">
              식단이나 혈당을 말해보세요
            </h2>
          </div>

          <div className="relative mb-12">
            {isListening && (
              <div className="absolute inset-0 scale-[1.8]">
                <div className="absolute inset-0 bg-[var(--color-primary)] rounded-full animate-ping opacity-20" />
                <div
                  className="absolute inset-0 bg-[var(--color-accent)] rounded-full animate-ping opacity-10"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            )}
            <button
              onClick={isListening ? stopListening : startListening}
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

          <div className="w-full min-h-[100px] mb-8 p-6 bg-[var(--color-bg-primary)] rounded-[32px] border border-[var(--color-border)] flex items-center justify-center text-center">
            {transcript ? (
              <p className="text-sm font-bold text-[var(--color-text-primary)] leading-relaxed italic">
                "{transcript}"
              </p>
            ) : (
              <p className="text-xs font-bold text-[var(--color-text-muted)]">
                예: "점심으로 닭가슴살 샐러드 먹었어"
                <br />
                또는 "지금 혈당 120 나왔어"
              </p>
            )}
          </div>

          {parseError && (
            <p className="text-xs text-rose-500 font-bold mb-4">{parseError}</p>
          )}

          <button
            onClick={handleParse}
            disabled={!transcript.trim()}
            className={`w-full py-5 rounded-[32px] font-black text-sm flex items-center justify-center gap-3 transition-all ${
              !transcript.trim()
                ? 'bg-gray-100 text-gray-400'
                : 'bg-[var(--color-accent)] text-white shadow-xl shadow-[var(--color-accent)]/20 active:scale-95'
            }`}
          >
            <Sparkles size={18} />
            AI로 분석하기
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
