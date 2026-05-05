'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MicIcon, X, Check, Loader2, Sparkles, Trash2 } from '@/components/common/Icons';
import type { FoodItem, MeasurementType } from '@/types';
import { apiFetch } from '@/lib/api/client';

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

// 음성 인식이 무음에 너무 빨리 종료되는 문제를 보완하기 위한 silence timeout (ms).
// 사용자가 추가 발화 없이 5초가 흐르면 자동으로 종료한다.
const SILENCE_TIMEOUT_MS = 5000;

function parseDetectedTime(timeStr: string): Date {
  const parts = timeStr.split(':').map(Number);
  const now = new Date();
  if (!isNaN(parts[0])) now.setHours(parts[0], isNaN(parts[1]) ? 0 : parts[1], 0, 0);
  return now;
}

type Step = 'input' | 'parsing' | 'preview';

const NUTRIENT_KEYS = ['calories', 'carbs', 'protein', 'fat', 'sodium'] as const;
type NutrientKey = typeof NUTRIENT_KEYS[number];

const VoiceInputModal: React.FC<VoiceInputModalProps> = ({ onClose, onConfirm, isSubmitting }) => {
  const [step, setStep] = useState<Step>('input');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // 미리보기에서 인라인 수정용
  const [editedGlucose, setEditedGlucose] = useState<number | null>(null);
  const [editedMeasType, setEditedMeasType] = useState<MeasurementType>('random');
  const [editedFoods, setEditedFoods] = useState<FoodItem[]>([]);

  // 음성 인식 silence timer / 수동 정지 플래그
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manuallyStoppedRef = useRef(false);
  const isListeningRef = useRef(false);

  // preview 진입 시 파싱 결과를 편집 state에 sync
  useEffect(() => {
    if (step !== 'preview' || !parsedResult) return;
    setEditedGlucose(parsedResult.glucoseValue ?? null);
    setEditedMeasType((parsedResult.detectedMeasType as MeasurementType) || 'random');
    setEditedFoods(parsedResult.parsedFoods ?? []);
  }, [step, parsedResult]);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const armSilenceTimer = (recog: any) => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // 5초 이상 추가 발화가 없으면 사용자가 끝낸 것으로 간주
      manuallyStoppedRef.current = true;
      try { recog?.stop(); } catch {}
    }, SILENCE_TIMEOUT_MS);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'ko-KR';

    recog.onresult = (event: any) => {
      // 새로운 결과가 들어올 때마다 silence timer 리셋 → 5초 무음까지 살려둠
      armSilenceTimer(recog);
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      setTranscript(final || interim);
    };

    recog.onspeechstart = () => armSilenceTimer(recog);
    recog.onaudiostart = () => armSilenceTimer(recog);

    // 일부 브라우저는 짧은 무음에서도 onend가 강제로 발생한다.
    // 사용자가 직접 멈춘 경우가 아니면 자동으로 다시 시작해서 5초 대기를 보장.
    recog.onend = () => {
      if (manuallyStoppedRef.current || !isListeningRef.current) {
        clearSilenceTimer();
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }
      try {
        recog.start();
      } catch {
        // 이미 시작됐거나 빠르게 재시작하면 InvalidStateError가 나는 경우가 있음 → 한 틱 뒤 재시도
        setTimeout(() => {
          if (!manuallyStoppedRef.current && isListeningRef.current) {
            try { recog.start(); } catch {}
          }
        }, 200);
      }
    };

    recog.onerror = (e: any) => {
      // no-speech / aborted 는 자동 재시작 흐름에서 자연스럽게 회복되므로 조용히 무시
      if (e?.error === 'no-speech' || e?.error === 'aborted') return;
      manuallyStoppedRef.current = true;
      clearSilenceTimer();
      setIsListening(false);
      isListeningRef.current = false;
    };

    setRecognition(recog);

    return () => {
      // 모달 언마운트 시 자동 재시작 흐름이 새 mic 세션을 못 만들도록 플래그 먼저 정리.
      manuallyStoppedRef.current = true;
      isListeningRef.current = false;
      clearSilenceTimer();
      try { recog.stop(); } catch {}
      try { recog.abort?.(); } catch {}
    };
  }, []);

  const startListening = () => {
    if (!recognition) return;
    setTranscript('');
    manuallyStoppedRef.current = false;
    isListeningRef.current = true;
    try {
      recognition.start();
    } catch {
      // 이미 실행 중이라면 무시
    }
    setIsListening(true);
    armSilenceTimer(recognition);
  };

  const stopListening = () => {
    manuallyStoppedRef.current = true;
    isListeningRef.current = false;
    clearSilenceTimer();
    try { recognition?.stop(); } catch {}
    setIsListening(false);
  };

  // Step 1 → Step 2: Gemini 파싱 요청
  const handleParse = async () => {
    if (!transcript.trim()) return;
    // 파싱 시작 전에 음성 인식이 살아 있으면 정리
    if (isListening) stopListening();
    setStep('parsing');
    setParseError(null);
    try {
      const res = await apiFetch('/api/parse-meal', {
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

  // Step 3: 실제 저장 — 인라인 편집된 값을 우선 사용
  const handleSave = () => {
    if (!parsedResult) return;
    const glucose =
      editedGlucose != null && !Number.isNaN(editedGlucose)
        ? { value: editedGlucose, type: editedMeasType }
        : undefined;
    const timestamp = parsedResult.detectedTime
      ? parseDetectedTime(parsedResult.detectedTime)
      : new Date();
    onConfirm(editedFoods, transcript, glucose, timestamp);
  };

  const handleReRecord = () => {
    setStep('input');
    setTranscript('');
    setParsedResult(null);
    setParseError(null);
  };

  // ── 항목 단위 삭제 ─────────────────────────────────────────────────────────
  const removeFood = (idx: number) => {
    setEditedFoods((prev) => prev.filter((_, j) => j !== idx));
  };

  const removeGlucose = () => {
    setEditedGlucose(null);
  };

  // ── 영양 수치 스케일링 ──────────────────────────────────────────────────────
  // 데이터 모델: food.calories 등은 단위(quantity=1) 기준 영양값.
  // UI에 보이는 값은 base * quantity 로 계산된 표시값.
  // 사용자가 표시값을 직접 편집하면 base = 표시값 / quantity 로 역산해서 저장한다.
  const displayValue = (food: FoodItem, key: NutrientKey): number => {
    const base = Number((food as any)[key]) || 0;
    const qty = Number(food.quantity) || 0;
    const v = base * qty;
    return key === 'calories' || key === 'sodium' ? Math.round(v) : Math.round(v * 10) / 10;
  };

  const updateFoodNutrient = (idx: number, key: NutrientKey, displayed: number) => {
    setEditedFoods((prev) =>
      prev.map((f, j) => {
        if (j !== idx) return f;
        const qty = Number(f.quantity) || 1;
        const newBase = qty > 0 ? displayed / qty : displayed;
        return { ...f, [key]: newBase };
      }),
    );
  };

  const updateFoodMeta = (idx: number, patch: Partial<FoodItem>) => {
    setEditedFoods((prev) => prev.map((f, j) => (j === idx ? { ...f, ...patch } : f)));
  };

  const hasFoods = (editedFoods?.length ?? 0) > 0;
  const hasGlucose = editedGlucose != null;

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
              ← 다시 입력하기
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
                    🍽 식단 <span className="text-gray-300 font-bold normal-case tracking-normal">· 탭해서 수정 · 휴지통으로 항목 삭제</span>
                  </p>
                  {editedFoods.map((food, i) => (
                    <div key={i} className="py-2 border-b border-gray-50 last:border-0">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={food.name}
                            onChange={(e) => updateFoodMeta(i, { name: e.target.value })}
                            className="w-full text-sm font-black text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-gray-200"
                          />
                          <div className="flex items-center gap-1 mt-0.5">
                            <input
                              type="number"
                              step="0.1"
                              value={food.quantity}
                              onChange={(e) => updateFoodMeta(i, { quantity: parseFloat(e.target.value) || 0 })}
                              className="w-12 text-[10px] text-gray-500 bg-gray-50 rounded px-1 py-0.5 outline-none focus:bg-white focus:ring-1 focus:ring-gray-200"
                            />
                            <input
                              type="text"
                              value={food.unit}
                              onChange={(e) => updateFoodMeta(i, { unit: e.target.value })}
                              className="w-14 text-[10px] text-gray-500 bg-gray-50 rounded px-1 py-0.5 outline-none focus:bg-white focus:ring-1 focus:ring-gray-200"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            value={displayValue(food, 'calories')}
                            onChange={(e) => updateFoodNutrient(i, 'calories', parseFloat(e.target.value) || 0)}
                            className="w-14 text-xs font-black text-gray-600 bg-gray-50 rounded px-1 py-0.5 text-right outline-none focus:bg-white focus:ring-1 focus:ring-gray-200"
                          />
                          <span className="text-xs font-black text-gray-600">kcal</span>
                          <button
                            onClick={() => removeFood(i)}
                            aria-label="이 항목 삭제"
                            className="ml-1 w-7 h-7 rounded-lg bg-rose-50 text-rose-400 flex items-center justify-center active:scale-90 hover:bg-rose-100 hover:text-rose-500 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-1">
                        {(['carbs','protein','fat'] as const).map((k) => (
                          <label key={k} className="flex items-center gap-1 text-[10px] text-gray-400">
                            {k === 'carbs' ? '탄수' : k === 'protein' ? '단백' : '지방'}
                            <input
                              type="number"
                              step="0.1"
                              value={displayValue(food, k)}
                              onChange={(e) => updateFoodNutrient(i, k, parseFloat(e.target.value) || 0)}
                              className="w-12 font-bold text-gray-600 bg-gray-50 rounded px-1 py-0.5 outline-none focus:bg-white focus:ring-1 focus:ring-gray-200"
                            />g
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasGlucose && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      💉 혈당 <span className="text-gray-300 font-bold normal-case tracking-normal">· 탭해서 수정</span>
                    </p>
                    <select
                      value={editedMeasType}
                      onChange={(e) => setEditedMeasType(e.target.value as MeasurementType)}
                      className="text-sm font-black text-gray-800 bg-gray-50 rounded-lg px-2 py-1 outline-none focus:bg-white focus:ring-1 focus:ring-gray-200"
                    >
                      {Object.entries(MEAS_TYPE_LABELS).map(([v, label]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <div className="flex items-baseline justify-end gap-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editedGlucose ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditedGlucose(v === '' ? null : Math.max(0, Math.min(999, parseInt(v, 10) || 0)));
                          }}
                          className="w-20 text-2xl font-black text-[var(--color-accent)] bg-gray-50 rounded-lg px-2 py-1 text-right outline-none focus:bg-white focus:ring-2 focus:ring-[var(--color-accent)]/30"
                        />
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5">mg/dL</p>
                    </div>
                    <button
                      onClick={removeGlucose}
                      aria-label="혈당 항목 삭제"
                      className="w-8 h-8 rounded-lg bg-rose-50 text-rose-400 flex items-center justify-center active:scale-90 hover:bg-rose-100 hover:text-rose-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
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
              다시 입력하기
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
              식단이나 혈당을 말하거나 입력하세요
            </h2>
            {isListening && (
              <p className="text-[10px] font-bold text-gray-400 mt-2">
                5초 동안 말이 없으면 자동으로 종료돼요
              </p>
            )}
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

          <div className="w-full mb-8">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={"말하거나 직접 입력하세요\n예: 점심으로 닭가슴살 샐러드 먹었어\n또는: 지금 혈당 120 나왔어"}
              rows={4}
              className="w-full p-5 bg-[var(--color-bg-primary)] rounded-[28px] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-primary)] leading-relaxed resize-none outline-none focus:border-[var(--color-accent)] transition-colors placeholder:text-[var(--color-text-muted)] placeholder:font-normal placeholder:text-xs"
            />
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
