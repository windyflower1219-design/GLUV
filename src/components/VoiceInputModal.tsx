'use client';

import React, { useState, useCallback } from 'react';
import { Mic, X, Send, Loader2, ChevronRight, Sparkles } from 'lucide-react';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';
import { parseMealText } from '@/lib/algorithms/mealParser';
import type { FoodItem, VoiceParseResult } from '@/types';

interface VoiceInputModalProps {
  onClose: () => void;
  onConfirm: (foods: Partial<FoodItem>[], rawText: string) => void;
  isSubmitting?: boolean;
}

export default function VoiceInputModal({ onClose, onConfirm, isSubmitting = false }: VoiceInputModalProps) {
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
      <div className="modal-sheet bg-[#FFFCF7] border-none shadow-2xl rounded-[40px]">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-2xl shadow-sm border border-white">
              🍱
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800">식사 기록하기</h2>
              <p className="text-xs font-bold text-gray-400 mt-0.5">무엇을 맛있게 드셨나요?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-all active:scale-90"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* 음성 입력 영역 */}
        {!parseResult && (
          <div className="animate-fade-in">
            <div className="flex flex-col items-center py-6 space-y-6">
              {/* 마이크 버튼 */}
              <div className="relative">
                {isListening && (
                  <>
                    <div className="absolute -inset-4 rounded-full bg-rose-400/20 animate-ping" />
                    <div className="absolute -inset-8 rounded-full bg-rose-400/10 animate-pulse" />
                  </>
                )}
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={!isSupported || isParsing}
                  className={`relative w-24 h-24 rounded-[32px] flex items-center justify-center transition-all duration-500 shadow-xl ${
                    isListening
                      ? 'bg-rose-500 shadow-rose-200 rotate-12 scale-110'
                      : 'bg-white border-4 border-rose-50 hover:border-rose-100'
                  } disabled:opacity-40 active:scale-95`}
                  aria-label={isListening ? '듣고 있어요!' : '말씀해주세요'}
                >
                  {isParsing ? (
                    <Loader2 size={40} className="text-rose-500 animate-spin" />
                  ) : isListening ? (
                    <div className="flex gap-2 items-center justify-center h-10">
                      {[...Array(4)].map((_, i) => (
                        <div 
                          key={i} 
                          className="w-1.5 h-6 bg-white rounded-full animate-wave" 
                          style={{ animationDelay: `${i * 0.15}s` }} 
                        />
                      ))}
                    </div>
                  ) : (
                    <Mic size={40} className="text-rose-400" />
                  )}
                </button>
              </div>

              {/* 실시간 인식 텍스트 */}
              <div className="min-h-[60px] flex flex-col items-center justify-center px-4">
                <div className="bg-white/60 backdrop-blur-sm px-6 py-3 rounded-2xl border border-rose-50 shadow-sm min-w-[200px] text-center">
                  {isListening && (
                    <p className="text-rose-600 font-black text-sm">
                      {interimTranscript || '귀 기울여 듣고 있어요... ✨'}
                    </p>
                  )}
                  {!isListening && !isParsing && (
                    <p className="text-gray-400 font-bold text-xs leading-relaxed text-center">
                      {isSupported ? (
                        <>분홍색 마이크를 누르고<br/>편하게 말씀해주세요!</>
                      ) : (
                        '죄송해요, 이 브라우저에서는<br/>음성 인식이 어려워요 😿'
                      )}
                    </p>
                  )}
                  {isParsing && (
                    <div className="flex items-center gap-2 justify-center">
                      <p className="text-rose-400 font-black text-sm animate-pulse text-center">영양 성분 분석 중...</p>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 text-rose-500 text-[10px] font-bold px-4 py-2 rounded-xl border border-rose-100 flex items-center gap-2 animate-shake">
                  <span>⚠️</span> {error}
                </div>
              )}
            </div>

            {/* 예시 문구 */}
            <div className="mb-6 bg-gray-50/50 p-4 rounded-3xl border border-gray-50">
              <p className="text-[10px] font-black text-gray-400 mb-3 ml-1 flex items-center gap-1">
                <Sparkles size={10} /> 이렇게 말씀해보세요
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  '점심에 제육볶음이랑 밥 먹었어',
                  '아침으로 사과 반 개랑 요거트 한 컵',
                  '간식으로 아메리카노 한 잔 했어'
                ].map(ex => (
                  <button
                    key={ex}
                    onClick={() => { setTextInput(ex); handleVoiceResult(ex); }}
                    className="text-[11px] font-bold px-4 py-2 rounded-2xl bg-white text-gray-500 hover:text-rose-500 hover:bg-rose-50 transition-all border border-gray-100 shadow-sm active:scale-95"
                  >
                    "{ex}"
                  </button>
                ))}
              </div>
            </div>

            {/* 텍스트 입력 */}
            <div className="relative group">
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
                placeholder="직접 입력할 수도 있어요!"
                className="w-full bg-white border-2 border-gray-50 rounded-2xl py-4 px-5 pr-14 text-sm font-bold text-gray-700 outline-none focus:border-rose-200 transition-all shadow-inner"
              />
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || isParsing}
                className="absolute right-2 top-2 w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center disabled:opacity-20 active:scale-90 transition-all shadow-md"
              >
                <Send size={18} className="text-white" />
              </button>
            </div>
          </div>
        )}

        {/* 파싱 결과 확인 */}
        {parseResult && (
          <div className="animate-fade-in">
            {parseResult.needsClarification && (
              <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
                <span className="text-xl">🧐</span>
                <p className="text-amber-800 font-bold text-xs leading-relaxed">{parseResult.clarificationQuestion}</p>
              </div>
            )}

            <div className="flex items-center justify-between mb-4 px-1">
              <p className="text-xs font-black text-gray-500">인식된 음식 정보</p>
              <p className="text-[10px] font-bold text-rose-400">총 {parseResult.parsedFoods.length}개</p>
            </div>
            
            <div className="space-y-3 mb-6">
              {parseResult.parsedFoods.map((food, i) => (
                <div key={i} className="bg-white border border-gray-100 p-4 rounded-3xl shadow-sm flex items-center justify-between group hover:border-rose-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gray-50 font-bold text-sm flex items-center justify-center text-gray-400 group-hover:bg-rose-50 group-hover:text-rose-400 transition-colors">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-black text-gray-800 text-sm">{food.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                        {food.quantity}{food.unit} · {food.calories}kcal · 탄수 {food.carbs}g
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black shadow-sm ${
                    (food.glycemicIndex ?? 0) >= 70 ? 'bg-rose-50 text-rose-500' :
                    (food.glycemicIndex ?? 0) >= 55 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    지수 {food.glycemicIndex}
                  </div>
                </div>
              ))}

              {parseResult.parsedFoods.length === 0 && (
                <div className="py-12 bg-gray-50/50 rounded-[32px] border-2 border-dashed border-gray-100 flex flex-col items-center gap-2">
                  <span className="text-4xl">🌵</span>
                  <p className="text-xs font-bold text-gray-400 text-center">음식을 찾지 못했어요. 다시 말씀해 주실래요?</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setParseResult(null)}
                className="flex-[0.4] bg-gray-100 text-gray-500 py-4 px-6 rounded-2xl font-black text-sm active:scale-95 transition-all"
              >
                다시 하기
              </button>
              <button
                onClick={() => {
                  if (parseResult.parsedFoods.length > 0) {
                    onConfirm(parseResult.parsedFoods, parseResult.rawText);
                  }
                }}
                disabled={parseResult.parsedFoods.length === 0 || isSubmitting}
                className="flex-1 bg-gray-800 text-white py-4 px-6 rounded-2xl font-black text-sm shadow-xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">저장 중... <Loader2 size={18} className="animate-spin" /></span>
                ) : (
                  <>기록 완료 <ChevronRight size={18} strokeWidth={3} /></>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
