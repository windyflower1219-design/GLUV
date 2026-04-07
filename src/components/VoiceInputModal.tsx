'use client';

import React, { useState, useCallback } from 'react';
import { Mic, X, Send, Loader2, ChevronRight } from 'lucide-react';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';
import { parseMealText } from '@/lib/algorithms/mealParser';
import type { FoodItem, VoiceParseResult } from '@/types';

interface VoiceInputModalProps {
  onClose: () => void;
  onConfirm: (foods: Partial<FoodItem>[], rawText: string) => void;
}

export default function VoiceInputModal({ onClose, onConfirm }: VoiceInputModalProps) {
  const [parseResult, setParseResult] = useState<VoiceParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [textInput, setTextInput] = useState('');

  const handleVoiceResult = useCallback(async (text: string) => {
    setIsParsing(true);
    try {
      const result = await parseMealText(text);
      setParseResult(result);
      setTextInput(text);
    } catch (err) {
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const { state, interimTranscript, error, isSupported, startListening, stopListening } =
    useVoiceInput(handleVoiceResult);

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setIsParsing(true);
    try {
      const result = await parseMealText(textInput);
      setParseResult(result);
    } finally {
      setIsParsing(false);
    }
  };

  const isListening = state === 'listening';

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">식사 기록</h2>
            <p className="text-sm text-slate-400 mt-0.5">음성이나 텍스트로 입력하세요</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={18} className="text-slate-300" />
          </button>
        </div>

        {/* 음성 입력 영역 */}
        {!parseResult && (
          <>
            <div className="flex flex-col items-center py-8 space-y-4">
              {/* 마이크 버튼 */}
              <div className="relative">
                {isListening && (
                  <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                )}
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={!isSupported || isParsing}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isListening
                      ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]'
                      : 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-[0_0_30px_rgba(59,130,246,0.4)]'
                  } disabled:opacity-40`}
                  aria-label={isListening ? '음성 입력 중지' : '음성 입력 시작'}
                >
                  {isParsing ? (
                    <Loader2 size={32} className="text-white animate-spin" />
                  ) : isListening ? (
                    <div className="flex gap-1 items-end h-8">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="wave-bar bg-white" style={{ animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                  ) : (
                    <Mic size={32} className="text-white" />
                  )}
                </button>
              </div>

              {/* 실시간 인식 텍스트 */}
              <div className="min-h-[48px] flex items-center justify-center px-4">
                {isListening && (
                  <p className="text-center text-slate-300 text-sm animate-pulse">
                    {interimTranscript || '말씀해주세요...'}
                  </p>
                )}
                {!isListening && !isParsing && (
                  <p className="text-center text-slate-500 text-sm">
                    {isSupported ? '버튼을 눌러 말씀해주세요' : 'Chrome 브라우저에서 사용 가능합니다'}
                  </p>
                )}
                {isParsing && (
                  <p className="text-center text-blue-400 text-sm">AI 분석 중...</p>
                )}
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl px-4 py-2">
                  {error}
                </p>
              )}
            </div>

            {/* 예시 문구 */}
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2">💬 이렇게 말해보세요</p>
              <div className="flex flex-wrap gap-2">
                {['점심에 김치찌개랑 밥 먹었어', '아침에 라면 한 봉지', '저녁 제육볶음 반 인분'].map(ex => (
                  <button
                    key={ex}
                    onClick={() => { setTextInput(ex); handleVoiceResult(ex); }}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-slate-400 hover:bg-blue-500/20 hover:text-blue-300 transition-colors border border-white/5"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* 텍스트 입력 구분선 */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-xs text-slate-600">또는 직접 입력</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            {/* 텍스트 입력 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
                placeholder="예: 김치찌개 + 밥 한 공기"
                className="input-dark flex-1"
              />
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || isParsing}
                className="w-12 h-12 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Send size={18} className="text-white" />
              </button>
            </div>
          </>
        )}

        {/* 파싱 결과 확인 */}
        {parseResult && (
          <div className="animate-fade-in">
            {parseResult.needsClarification && (
              <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-yellow-300 text-sm">🤔 {parseResult.clarificationQuestion}</p>
              </div>
            )}

            <p className="text-sm text-slate-400 mb-3">인식된 음식</p>
            <div className="space-y-2 mb-6">
              {parseResult.parsedFoods.map((food, i) => (
                <div key={i} className="glass-card p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white text-sm">{food.name}</p>
                    <p className="text-xs text-slate-400">
                      {food.quantity}{food.unit} · {food.calories}kcal · 탄수화물 {food.carbs}g
                    </p>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    (food.glycemicIndex ?? 0) >= 70 ? 'glucotype-red' :
                    (food.glycemicIndex ?? 0) >= 55 ? 'glucotype-yellow' : 'glucotype-green'
                  }`}>
                    GI {food.glycemicIndex}
                  </div>
                </div>
              ))}

              {parseResult.parsedFoods.length === 0 && (
                <p className="text-center text-slate-500 py-4">음식을 인식하지 못했습니다</p>
              )}
            </div>

            {/* 신뢰도 */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${(parseResult.confidenceScore ?? 0) * 100}%` }}
                />
              </div>
              <span className="text-xs text-slate-500">신뢰도 {Math.round((parseResult.confidenceScore ?? 0) * 100)}%</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setParseResult(null)}
                className="btn-ghost flex-1"
              >
                다시 입력
              </button>
              <button
                onClick={() => {
                  if (parseResult.parsedFoods.length > 0) {
                    onConfirm(parseResult.parsedFoods, parseResult.rawText);
                    onClose();
                  }
                }}
                disabled={parseResult.parsedFoods.length === 0}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                기록하기 <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
