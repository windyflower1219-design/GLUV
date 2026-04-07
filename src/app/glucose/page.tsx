'use client';

import React, { useState } from 'react';
import { Plus, TrendingDown, TrendingUp, Minus, Target, Activity } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, ComposedChart, Line
} from 'recharts';
import BottomNavigation from '@/components/BottomNavigation';
import { useGlucoseData } from '@/lib/hooks/useGlucoseData';
import { analyzeWeeklyTrend } from '@/lib/algorithms/glucoseAnalysis';
import type { GlucoseReading } from '@/types';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}

function GlucoseTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    const color = val > 140 ? '#ef4444' : val < 70 ? '#f59e0b' : '#10b981';
    return (
      <div className="glass-card px-3 py-2 text-xs">
        <p className="text-slate-400">{label}</p>
        <p className="font-bold text-sm" style={{ color }}>{val} mg/dL</p>
      </div>
    );
  }
  return null;
}

const WEEK_DATA = [
  { day: '월', avg: 118, high: 152, low: 88 },
  { day: '화', avg: 124, high: 168, low: 92 },
  { day: '수', avg: 110, high: 139, low: 85 },
  { day: '목', avg: 128, high: 172, low: 94 },
  { day: '금', avg: 115, high: 148, low: 89 },
  { day: '토', avg: 108, high: 135, low: 82 },
  { day: '일', avg: 121, high: 155, low: 90 },
];

const MEASUREMENT_TYPES: Record<GlucoseReading['measurementType'], { label: string; order: number }> = {
  fasting: { label: '공복', order: 0 },
  postmeal_30m: { label: '식후 30분', order: 1 },
  postmeal_1h: { label: '식후 1시간', order: 2 },
  postmeal_2h: { label: '식후 2시간', order: 3 },
  random: { label: '임의 측정', order: 4 },
};

type PeriodType = 'day' | 'week' | 'month';

export default function GlucosePage() {
  const [period, setPeriod] = useState<PeriodType>('day');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGlucoseValue, setNewGlucoseValue] = useState('');
  const [newMeasType, setNewMeasType] = useState<GlucoseReading['measurementType']>('random');

  const { readings, currentGlucose, averageGlucose, timeInRange, addReading, getChartData } = useGlucoseData('demo');
  const chartData = getChartData();
  const weeklyAnalysis = analyzeWeeklyTrend(readings);

  const handleAddReading = () => {
    const value = parseInt(newGlucoseValue);
    if (isNaN(value) || value < 20 || value > 600) return;
    addReading(value, newMeasType);
    setNewGlucoseValue('');
    setShowAddModal(false);
  };

  const TrendIcon = weeklyAnalysis.trend === 'improving' ? TrendingDown :
                    weeklyAnalysis.trend === 'worsening' ? TrendingUp : Minus;
  const trendColor = weeklyAnalysis.trend === 'improving' ? 'text-emerald-400' :
                     weeklyAnalysis.trend === 'worsening' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 page-content">
      <header className="safe-top px-5 pt-4 pb-3 sticky top-0 bg-gray-950/90 backdrop-blur z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-white">혈당 추이</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium active:scale-95 transition-all"
          >
            <Plus size={16} /> 혈당 입력
          </button>
        </div>

        {/* 기간 탭 */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5">
          {(['day', 'week', 'month'] as PeriodType[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === p ? 'bg-blue-500 text-white' : 'text-slate-400'
              }`}
            >
              {p === 'day' ? '오늘' : p === 'week' ? '1주' : '1달'}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 space-y-4">
        {/* 핵심 지표 카드 3개 */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '현재', value: currentGlucose, unit: 'mg/dL', icon: <Activity size={14} />, color: 'text-blue-400' },
            { label: '평균', value: averageGlucose, unit: 'mg/dL', icon: <Target size={14} />, color: 'text-purple-400' },
            { label: '목표 범위', value: timeInRange, unit: '%', icon: <TrendIcon size={14} />, color: trendColor },
          ].map(({ label, value, unit, icon, color }) => (
            <div key={label} className="glass-card p-3 text-center">
              <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-500">{unit}</p>
              <p className="text-[10px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* 메인 차트 */}
        <div className="glass-card p-4">
          <h2 className="font-semibold text-white text-sm mb-4">
            {period === 'day' ? '오늘 혈당 변화' : period === 'week' ? '주간 혈당 추이' : '월간 혈당 추이'}
          </h2>

          {period === 'day' && (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  {/* 위험 구간 오버레이 */}
                  <linearGradient id="dangerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis domain={[50, 220]} tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
                <ReferenceLine y={140} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 4" label={{ value: '상한', fill: '#ef4444', fontSize: 9, position: 'right' }} />
                <ReferenceLine y={70} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 4" label={{ value: '하한', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
                <Tooltip content={<GlucoseTooltip />} />
                <Area type="monotone" dataKey="glucose" stroke="#3b82f6" strokeWidth={2.5}
                  fill="url(#gGrad)" dot={{ r: 4, fill: '#3b82f6', stroke: '#1e3a5f', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#60a5fa' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {period === 'week' && (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={WEEK_DATA} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[50, 220]} tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
                <ReferenceLine y={140} stroke="rgba(239,68,68,0.3)" strokeDasharray="4 4" />
                <ReferenceLine y={70} stroke="rgba(245,158,11,0.3)" strokeDasharray="4 4" />
                <Tooltip />
                <Bar dataKey="high" fill="rgba(239,68,68,0.2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="low" fill="rgba(245,158,11,0.15)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#3b82f6' }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {/* 범례 */}
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs text-slate-500">{period === 'week' ? '평균' : '혈당'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-px bg-red-500" />
              <span className="text-xs text-slate-500">상한 140</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-px bg-yellow-500" />
              <span className="text-xs text-slate-500">하한 70</span>
            </div>
          </div>
        </div>

        {/* 통계 요약 */}
        <div className="glass-card p-4">
          <h2 className="font-semibold text-white text-sm mb-3">측정 통계</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '최고 혈당', value: weeklyAnalysis.highestGlucose, unit: 'mg/dL', color: 'text-red-400' },
              { label: '최저 혈당', value: weeklyAnalysis.lowestGlucose, unit: 'mg/dL', color: 'text-yellow-400' },
              { label: '스파이크 횟수', value: weeklyAnalysis.spikeCount, unit: '회 (>180)', color: 'text-orange-400' },
              { label: '목표 범위', value: `${timeInRange}%`, unit: 'TIR', color: 'text-emerald-400' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="bg-white/3 rounded-xl p-3">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-500">{unit}</p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 최근 측정 기록 */}
        <div>
          <h2 className="font-semibold text-white text-sm mb-3">최근 측정 기록</h2>
          <div className="space-y-2">
            {readings.slice(-6).reverse().map(reading => {
              const isHigh = reading.value > 140;
              const isLow = reading.value < 70;
              const color = isHigh ? 'text-red-400 glucotype-red' : isLow ? 'text-yellow-400 glucotype-yellow' : 'text-emerald-400 glucotype-green';
              return (
                <div key={reading.id} className="glass-card p-3 flex items-center gap-3">
                  <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
                    {reading.value}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white">{MEASUREMENT_TYPES[reading.measurementType].label}</p>
                    <p className="text-xs text-slate-500">
                      {reading.timestamp.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-xs text-slate-600">mg/dL</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 혈당 입력 모달 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal-sheet">
            <h2 className="text-xl font-bold text-white mb-6">혈당 수동 입력</h2>

            <div className="mb-4">
              <label className="text-sm text-slate-400 mb-2 block">혈당 수치 (mg/dL)</label>
              <input
                type="number"
                value={newGlucoseValue}
                onChange={e => setNewGlucoseValue(e.target.value)}
                placeholder="예: 126"
                className="input-dark text-2xl text-center font-bold"
                min={20} max={600}
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="text-sm text-slate-400 mb-2 block">측정 시점</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(MEASUREMENT_TYPES) as Array<[GlucoseReading['measurementType'], { label: string; order: number }]>)
                  .sort((a, b) => a[1].order - b[1].order)
                  .map(([key, { label }]) => (
                    <button
                      key={key}
                      onClick={() => setNewMeasType(key)}
                      className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                        newMeasType === key
                          ? 'bg-blue-500 text-white'
                          : 'glass-card text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="btn-ghost flex-1">취소</button>
              <button
                onClick={handleAddReading}
                disabled={!newGlucoseValue}
                className="btn-primary flex-1"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}
