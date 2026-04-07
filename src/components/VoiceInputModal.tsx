'use client';

import React, { useState, useCallback } from 'react';
import { Mic, X, Send, Loader2, ChevronRight, Sparkles } from 'lucide-react';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';
import { parseMealText } from '@/lib/algorithms/mealParser';
import type { FoodItem, VoiceParseResult, MeasurementType } from '@/types';

interface VoiceInputModalProps {
  onClose: () => void;
  onConfirm: (foods: Partial<FoodItem>[], rawText: string, glucose?: { value: number; type: MeasurementType }) => void;
  isSubmitting?: boolean;
}

export default function VoiceInputModal({ onClose, onConfirm, isSubmitting = false }: VoiceInputModalProps) {
  const [parseResult, setParseResult] = useState<VoiceParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [editedGlucose, setEditedGlucose] = useState<number | undefined>(undefined);

  const handleVoiceResult = useCallback(async (text: string) => {
    setIsParsing(true);
    try {
      const result = await parseMealText(text);
      setParseResult(result);
      setTextInput(text);
      if (result.glucoseValue) {
        setEditedGlucose(result.glucoseValue);
      }
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
              <h2 className="text-xl font-black text-gray-800">통합 음성 비서</h2>
              <p className="text-xs font-bold text-gray-400 mt-0.5">식사와 혈당을 한 번에 기록해보세요</p>
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
                    <div className="space-y-4">
                      <p className="text-rose-600 font-black text-sm leading-relaxed whitespace-pre-wrap">
                        {interimTranscript || '귀 기울여 듣고 있어요... ✨'}
                      </p>
                      <button
                        onClick={stopListening}
                        className="bg-rose-100 text-rose-600 px-6 py-2 rounded-xl font-black text-xs animate-bounce"
                      >
                        말씀 끝났으면 눌러주세요 ✅
                      </button>
                    </div>
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
                  '식후 혈당 125 나왔어'
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
          <div className="animate-fade-in max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
            {parseResult.needsClarification && (
              <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
                <span className="text-xl">🧐</span>
                <p className="text-amber-800 font-bold text-xs leading-relaxed">{parseResult.clarificationQuestion}</p>
              </div>
            )}

            {/* 혈당 인식 결과 카드 */}
            {editedGlucose !== undefined && (
              <div className="mb-6">
                <p className="text-xs font-black text-gray-500 mb-3 px-1">인식된 혈당 정보</p>
                <div className="bg-white border-2 border-indigo-50 rounded-[32px] p-5 shadow-sm flex items-center gap-5">
                   <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl shadow-inner border border-white">
                    🩸
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-1">
                      <input 
                        type="number"
                        value={editedGlucose}
                        onChange={(e) => setEditedGlucose(parseInt(e.target.value) || 0)}
                        className="text-2xl font-black text-gray-800 bg-transparent w-20 outline-none border-b-2 border-transparent focus:border-indigo-200"
                      />
                      <span className="text-xs font-black text-gray-400">mg/dL</span>
                    </div>
                    <p className="text-[10px] font-bold text-indigo-400 mt-1 uppercase">
                      시점: {
                        parseResult.detectedMeasType === 'fasting' ? '공복' :
                        parseResult.detectedMeasType === 'postmeal_30m' ? '식후 30분' :
                        parseResult.detectedMeasType === 'postmeal_1h' ? '식후 1시간' :
                        parseResult.detectedMeasType === 'postmeal_2h' ? '식후 2시간' : '임의 측정'
                      }
                    </p>
                  </div>
                </div>
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
                </div>
              ))}

              {parseResult.parsedFoods.length === 0 && editedGlucose === undefined && (
                <div className="py-12 bg-gray-50/50 rounded-[32px] border-2 border-dashed border-gray-100 flex flex-col items-center gap-2">
                  <span className="text-4xl">🌵</span>
                  <p className="text-xs font-bold text-gray-400 text-center">정보를 찾지 못했어요. 다시 말씀해 주실래요?</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 sticky bottom-0 bg-[#FFFCF7]/95 backdrop-blur py-2">
              <button
                onClick={() => {
                  setParseResult(null);
                  setEditedGlucose(undefined);
                }}
                className="flex-[0.4] bg-gray-100 text-gray-500 py-4 px-6 rounded-2xl font-black text-sm active:scale-95 transition-all"
              >
                다시 하기
              </button>
              <button
                onClick={() => {
                  const glucoseData = editedGlucose !== undefined ? {
                    value: editedGlucose,
                    type: parseResult.detectedMeasType || 'random'
                  } : undefined;
                  
                  onConfirm(parseResult.parsedFoods, parseResult.rawText, glucoseData);
                }}
                disabled={(parseResult.parsedFoods.length === 0 && editedGlucose === undefined) || isSubmitting}
                className="flex-1 bg-gray-800 text-white py-4 px-6 rounded-2xl font-black text-sm shadow-xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">저장 중... <Loader2 size={18} className="animate-spin" /></span>
                ) : (
                  <>모두 기록 완료 <ChevronRight size={18} strokeWidth={3} /></>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
