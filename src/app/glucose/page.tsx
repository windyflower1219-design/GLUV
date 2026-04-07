'use client';

import React, { useState } from 'react';
import { Plus, TrendingDown, TrendingUp, Minus, Target, Activity, Heart, Calendar, ChevronRight } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, ComposedChart, Line
} from 'recharts';
import BottomNavigation from '@/components/BottomNavigation';
import { useGlucoseData } from '@/lib/hooks/useGlucoseData';
import { analyzeWeeklyTrend } from '@/lib/algorithms/glucoseAnalysis';
import VoiceInputModal from '@/components/VoiceInputModal';
import { saveMeal } from '@/lib/firebase/firestore';
import type { GlucoseReading, FoodItem, MeasurementType } from '@/types';
import { Mic, Loader2 } from 'lucide-react';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}

function GlucoseTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    const color = val > 140 ? 'var(--color-danger)' : val < 70 ? 'var(--color-warning)' : 'var(--color-success)';
    return (
      <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-gray-100 shadow-xl">
        <p className="text-[10px] font-bold text-gray-400 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <p className="font-black text-sm text-gray-700">{val} <span className="text-[10px] font-bold text-gray-400">mg/dL</span></p>
        </div>
      </div>
    );
  }
  return null;
}

const MEASUREMENT_TYPES: Record<GlucoseReading['measurementType'], { label: string; order: number; emoji: string }> = {
  fasting: { label: '공복', order: 0, emoji: '🌅' },
  postmeal_30m: { label: '식후 30분', order: 1, emoji: '🍰' },
  postmeal_1h: { label: '식후 1시간', order: 2, emoji: '🍚' },
  postmeal_2h: { label: '식후 2시간', order: 3, emoji: '🚶' },
  random: { label: '임의 측정', order: 4, emoji: '📍' },
};

type PeriodType = 'day' | 'week' | 'month';

export default function GlucosePage() {
  const [period, setPeriod] = useState<PeriodType>('day');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGlucoseValue, setNewGlucoseValue] = useState('');
  const [newMeasType, setNewMeasType] = useState<GlucoseReading['measurementType']>('random');
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  const { readings, loading, isSubmitting, currentGlucose, averageGlucose, timeInRange, addReading, getChartData } = useGlucoseData('demo');
  const chartData = getChartData();
  const weeklyAnalysis = analyzeWeeklyTrend(readings);

  const handleAddReading = async () => {
    const value = parseInt(newGlucoseValue);
    if (isNaN(value) || value < 20 || value > 600) return;
    try {
      await addReading(value, newMeasType);
      setNewGlucoseValue('');
      setShowAddModal(false);
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        alert('저장에 실패했습니다. Firebase 콘솔에서 Firestore 규칙(Rules)을 "테스트 모드"로 설정했는지 확인해주세요.');
      } else {
        alert('저장에 실패했습니다. Vercel 환경 변수가 모두 정확히 입력되었는지 확인해주세요.');
      }
    }
  };

  const handleVoiceConfirm = async (
    foods: Partial<FoodItem>[], 
    rawText: string,
    glucose?: { value: number; type: MeasurementType }
  ) => {
    try {
      // 1. 혈당 저장 (인식된 경우)
      if (glucose) {
        await addReading(glucose.value, glucose.type);
      }
      
      // 2. 식단 저장 (인식된 경우)
      if (foods.length > 0) {
        // 임시로 MealsPage와 동일한 로직 적용 (userId 등)
        await saveMeal({
          userId: 'demo',
          timestamp: new Date(),
          mealType: 'snack', // 기본값
          rawVoiceInput: rawText,
          parsedFoods: foods as FoodItem[],
          totalCarbs: foods.reduce((s, f) => s + (f.carbs || 0) * (f.quantity || 1), 0),
          totalCalories: foods.reduce((s, f) => s + (f.calories || 0) * (f.quantity || 1), 0),
          glucotypeScore: 'yellow',
        });
      }
      setShowVoiceModal(false);
    } catch (error) {
      alert('연속 저장 중 오류가 발생했습니다.');
    }
  };

  const TrendIcon = weeklyAnalysis.trend === 'improving' ? TrendingDown :
                    weeklyAnalysis.trend === 'worsening' ? TrendingUp : Minus;
  const trendColor = weeklyAnalysis.trend === 'improving' ? 'text-[var(--color-success)]' :
                     weeklyAnalysis.trend === 'worsening' ? 'text-[var(--color-danger)]' : 'text-gray-400';

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] page-content">
      <header className="safe-top px-5 pt-4 pb-3 sticky top-0 bg-[var(--color-bg-primary)]/90 backdrop-blur z-10 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">혈당 리포트</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[var(--color-accent-pink)] text-white text-sm font-black shadow-lg shadow-rose-100 active:scale-95 transition-all"
          >
            <Plus size={18} strokeWidth={3} /> 기록하기
          </button>
        </div>

        {/* 기간 탭 */}
        <div className="flex gap-1 p-1 rounded-2xl bg-white border border-[var(--color-border)]">
          {(['day', 'week', 'month'] as PeriodType[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                period === p ? 'bg-[var(--color-accent-pink)] text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              {p === 'day' ? '오늘 하루' : p === 'week' ? '이번 주' : '이번 달'}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 space-y-5 pt-4">
        {/* 핵심 지표 카드 3개 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '현재 혈당', value: currentGlucose, unit: 'mg/dL', icon: <Activity size={16} />, color: 'text-rose-500', bg: 'bg-rose-50' },
            { label: '평균 혈당', value: averageGlucose, unit: 'mg/dL', icon: <Target size={16} />, color: 'text-indigo-500', bg: 'bg-indigo-50' },
            { label: '목표 범위', value: timeInRange, unit: '%', icon: <Heart size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          ].map(({ label, value, unit, icon, color, bg }) => (
            <div key={label} className="bg-white rounded-3xl p-4 text-center shadow-sm border border-[var(--color-border)] hover:border-rose-100 transition-colors">
              <div className={`w-8 h-8 rounded-xl ${bg} ${color} flex items-center justify-center mx-auto mb-2 shadow-inner border border-white`}>
                {icon}
              </div>
              <p className={`text-2xl font-black ${color}`}>{loading ? '-' : value}</p>
              <p className="text-[10px] font-bold text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* 메인 차트 */}
        <div className="glass-card p-5 border-none shadow-sm relative overflow-hidden bg-white/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-black text-gray-800 text-sm flex items-center gap-2">
               <span className="w-1.5 h-4 bg-[var(--color-accent-pink)] rounded-full mr-1" />
              {period === 'day' ? '오늘 하루 흐름' : period === 'week' ? '한 주간의 기록' : '한 달간의 기록'}
            </h2>
            <div className="text-[10px] font-bold text-gray-400 bg-white px-2 py-1 rounded-lg border border-gray-50 flex items-center gap-1">
              <Calendar size={10} /> mg/dL
            </div>
          </div>

          {loading ? (
            <div className="h-[200px] skeleton rounded-3xl" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent-pink)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-accent-pink)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" stroke="#f1f1f1" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  domain={[50, 200]} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <ReferenceLine 
                  y={140} 
                  stroke="#fda4af" 
                  strokeWidth={1} 
                  strokeDasharray="4 4" 
                />
                <ReferenceLine 
                  y={70} 
                  stroke="#ca8a04" 
                  strokeWidth={1} 
                  strokeDasharray="4 4" 
                />
                <Tooltip content={<GlucoseTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="glucose" 
                  stroke="var(--color-accent-pink)" 
                  strokeWidth={4}
                  fill="url(#areaGrad)" 
                  dot={{ r: 5, fill: 'white', stroke: 'var(--color-accent-pink)', strokeWidth: 3 }}
                  activeDot={{ r: 8, fill: 'var(--color-accent-pink)', stroke: 'white', strokeWidth: 3 }} 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {/* 가이드라인 설명 */}
          <div className="flex items-center justify-center gap-6 mt-6 p-3 bg-gray-50/50 rounded-2xl border border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent-pink)] shadow-sm" />
              <span className="text-[10px] font-bold text-gray-500">정상 범위</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-px border-t-2 border-dashed border-rose-300" />
              <span className="text-[10px] font-bold text-gray-500">목표 상한 (140)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-px border-t-2 border-dashed border-yellow-300" />
              <span className="text-[10px] font-bold text-gray-500">목표 하한 (70)</span>
            </div>
          </div>
        </div>

        {/* 측정 기록 목록 */}
        <div className="pb-4">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="font-black text-gray-800 text-sm flex items-center gap-2">
               <span className="w-1.5 h-4 bg-indigo-400 rounded-full mr-1" />
              최근 혈당 기록
            </h2>
            <button className="text-[10px] font-bold text-[var(--color-accent-pink)]">전체보기</button>
          </div>
          
          <div className="space-y-3">
            {loading ? (
              <div className="h-16 skeleton rounded-3xl" />
            ) : readings.length === 0 ? (
              <div className="py-12 bg-white/40 rounded-[32px] border-2 border-dashed border-gray-100 flex flex-col items-center gap-2">
                <span className="text-4xl">💧</span>
                <p className="text-xs font-bold text-gray-400">아직 입력된 기록이 없어요!</p>
              </div>
            ) : readings.slice().reverse().slice(0, 5).map(reading => {
              const isHigh = reading.value > 140;
              const isLow = reading.value < 70;
              const type = MEASUREMENT_TYPES[reading.measurementType];
              
              return (
                <div key={reading.id} className="bg-white rounded-3xl p-4 shadow-sm border border-[var(--color-border)] flex items-center gap-4 group hover:border-indigo-100 transition-colors">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-white ${
                    isHigh ? 'bg-rose-50 text-rose-500' : isLow ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {type.emoji}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-gray-800">{type.label}</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                      {reading.timestamp.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-black ${
                      isHigh ? 'text-[var(--color-danger)]' : isLow ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'
                    }`}>
                      {reading.value}
                    </p>
                    <p className="text-[9px] font-black text-gray-300">mg/dL</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 혈당 입력 모달 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal-sheet bg-[#FFFCF7] border-none shadow-2xl rounded-[40px] p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl shadow-sm border border-white">
                🩸
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800">혈당 기록하기</h2>
                <p className="text-xs font-bold text-gray-400 mt-0.5">꼼꼼하게 챙기는 당신이 아름다워요</p>
              </div>
            </div>

            <div className="mb-8">
              <div className="relative group">
                <input
                  type="number"
                  value={newGlucoseValue}
                  onChange={e => setNewGlucoseValue(e.target.value)}
                  placeholder="000"
                  className="w-full bg-white border-2 border-indigo-50 rounded-3xl py-6 px-5 text-4xl text-center font-black text-gray-800 outline-none focus:border-indigo-200 transition-all shadow-inner"
                  min={20} max={600}
                  autoFocus
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-black text-gray-300">mg/dL</span>
              </div>
            </div>

            <div className="mb-8">
              <p className="text-xs font-black text-gray-400 mb-4 ml-1">지금은 어떤 시점인가요?</p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(MEASUREMENT_TYPES) as Array<[GlucoseReading['measurementType'], { label: string; order: number; emoji: string }]>)
                  .sort((a, b) => a[1].order - b[1].order)
                  .map(([key, { label, emoji }]) => (
                    <button
                      key={key}
                      onClick={() => setNewMeasType(key)}
                      className={`py-4 px-3 rounded-2xl text-xs font-black transition-all border shadow-sm flex items-center justify-center gap-2 ${
                        newMeasType === key
                          ? 'bg-gray-800 text-white border-gray-800'
                          : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-100'
                      }`}
                    >
                      <span className="text-sm">{emoji}</span> {label}
                    </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setShowAddModal(false)} 
                className="flex-[0.4] bg-gray-100 text-gray-500 py-4 px-6 rounded-2xl font-black text-sm active:scale-95 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleAddReading}
                disabled={!newGlucoseValue || isSubmitting}
                className="flex-1 bg-gray-800 text-white py-4 px-6 rounded-2xl font-black text-sm shadow-xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-20"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">저장 중... <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></span>
                ) : (
                  <>기록 완료 <ChevronRight size={18} strokeWidth={3} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 플로팅 음성 버튼 */}
      <button
        onClick={() => setShowVoiceModal(true)}
        className="fab-mic bg-[var(--color-accent-pink)] shadow-xl shadow-rose-200 border-4 border-white"
        aria-label="말해서 기록하기"
      >
        <Mic size={28} className="text-white" />
      </button>

      {showVoiceModal && (
        <VoiceInputModal 
          onClose={() => setShowVoiceModal(false)} 
          onConfirm={handleVoiceConfirm}
          isSubmitting={isSubmitting}
        />
      )}

      <BottomNavigation />
    </div>
  );
}
