'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Activity, Target, Heart,
  Calendar, ChevronRight, Loader2, Clock,
  Pencil, Trash2, Check, X
} from '@/components/common/Icons';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';
import { useGlucoseData } from '@/lib/hooks/useGlucoseData';
import { analyzeWeeklyTrend } from '@/lib/algorithms/glucoseAnalysis';
import { useBackHandler } from '@/context/BackHandlerContext';
import type { GlucoseReading } from '@/types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine 
} from 'recharts';

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
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
  });
  const [selectedDate, setSelectedDate] = useState(new Date());

  const {
    readings, loading, isSubmitting, currentGlucose, averageGlucose, timeInRange,
    addReading, editReading, removeReading, getChartData,
  } = useGlucoseData();

  const dateOffsets = React.useMemo(() => {
    return [-3, -2, -1, 0, 1, 2, 3].map(offset => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d;
    });
  }, []);

  const filteredReadings = React.useMemo(() => {
    if (period !== 'day') return readings;
    return readings.filter(r => r.timestamp.toDateString() === selectedDate.toDateString());
  }, [readings, period, selectedDate]);

  const displayAverage = React.useMemo(() => {
    if (period !== 'day' || filteredReadings.length === 0) return averageGlucose;
    const sum = filteredReadings.reduce((s, r) => s + r.value, 0);
    return Math.round(sum / filteredReadings.length);
  }, [filteredReadings, averageGlucose, period]);

  const displayTimeInRange = React.useMemo(() => {
    if (period !== 'day' || filteredReadings.length === 0) return timeInRange;
    const inRange = filteredReadings.filter(r => r.value >= 70 && r.value <= 140).length;
    return Math.round((inRange / filteredReadings.length) * 100);
  }, [filteredReadings, timeInRange, period]);

  const chartData = React.useMemo(() => {
    if (period === 'day') {
      return filteredReadings
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        .map(r => ({
          time: r.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          glucose: r.value,
        }));
    } else {
      const daysCount = period === 'week' ? 7 : 30;
      const dailyMap = new Map<string, { sum: number, count: number, timestamp: number }>();
      
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysCount);

      readings.filter(r => r.timestamp >= cutoff).forEach(r => {
        const dateStr = r.timestamp.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        const existing = dailyMap.get(dateStr) || { sum: 0, count: 0, timestamp: r.timestamp.getTime() };
        dailyMap.set(dateStr, { 
          sum: existing.sum + r.value, 
          count: existing.count + 1,
          timestamp: Math.min(existing.timestamp, r.timestamp.getTime())
        });
      });

      return Array.from(dailyMap.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .map(([time, data]) => ({
          time,
          glucose: Math.round(data.sum / data.count)
        }));
    }
  }, [readings, filteredReadings, period]);

  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (reading: GlucoseReading) => {
    // 편집 기능을 위한 추가 구현이 필요할 수 있으나 현재는 모달로 연결하거나 단순 선택 처리
    // 여기서는 일단 편집 모드 진입 대신 클릭 시 기록 선택 정도로 처리하거나 필요 시 editReading 호출
  };

  const handleAddReading = async () => {
    const value = parseInt(newGlucoseValue);
    if (isNaN(value) || value < 20 || value > 600) return;
    try {
      await addReading(value, newMeasType, new Date(selectedTime));
      setNewGlucoseValue('');
      setShowAddModal(false);
      window.dispatchEvent(new CustomEvent('record-saved'));
    } catch (error: any) {
      alert(`저장에 실패했습니다: ${error.message || error}`);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] page-content">
      <PageHeader title="혈당 리포트" />

      <div className="px-5 space-y-5 pt-4 pb-24">
        {/* 기간 선택 탭 */}
        <div className="flex p-1 bg-white rounded-2xl border border-gray-100 shadow-sm">
          {(['day', 'week', 'month'] as PeriodType[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                period === p ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              {p === 'day' ? '일간' : p === 'week' ? '주간' : '월간'}
            </button>
          ))}
        </div>

        {/* 날짜 선택 (일간일 때만) */}
        {period === 'day' && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar animate-in fade-in duration-500">
            {dateOffsets.map(d => {
              const isSelected = selectedDate.toDateString() === d.toDateString();
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelectedDate(d)}
                  className={`flex flex-col items-center px-4 py-2 rounded-2xl min-w-[60px] transition-all border ${
                    isSelected ? 'bg-rose-500 text-white border-rose-500 shadow-lg' : 'bg-white text-gray-400 border-gray-100'
                  }`}
                >
                  <span className="text-[9px] font-bold opacity-70 mb-1">{d.toLocaleDateString('ko-KR', { weekday: 'short' })}</span>
                  <span className="text-sm font-black">{d.getDate()}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-[32px] border border-gray-50 shadow-sm">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">평균 혈당</p>
            <div className="flex items-baseline gap-1">
               <span className="text-2xl font-black text-gray-800">{displayAverage}</span>
               <span className="text-[10px] font-bold text-gray-400">mg/dL</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">목표 도달</p>
            <div className="flex items-baseline gap-1">
               <span className="text-2xl font-black text-emerald-500">{displayTimeInRange}</span>
               <span className="text-[10px] font-bold text-gray-400">%</span>
            </div>
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="bg-white p-6 rounded-[40px] border border-gray-50 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-gray-800">혈당 추이</h3>
            <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">
              {period === 'day' ? '시간별' : '일별 평균'}
            </span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -30 }}>
                <defs>
                  <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" stroke="#f8fafc" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: '#cbd5e1', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis domain={[40, 240]} tick={{ fill: '#cbd5e1', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlucoseTooltip />} />
                <Area type="monotone" dataKey="glucose" stroke="#F43F5E" strokeWidth={3} fill="url(#gGrad)" dot={{ r: 4, fill: 'white', stroke: '#F43F5E', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 혈당 입력 버튼 삭제 - 통합 음성 비서로 대체 */}

        {/* 기록 목록 */}
        <div className="space-y-4 pt-4">
          <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest px-1">상세 기록</h3>
          <div className="space-y-3">
            {filteredReadings.length === 0 ? (
              <div className="py-12 bg-gray-50 rounded-[32px] text-center border-2 border-dashed border-gray-100">
                <p className="text-xs font-bold text-gray-400">이날의 기록이 없습니다.</p>
              </div>
            ) : (
              filteredReadings.slice().reverse().map(r => (
                <div key={r.id} className="bg-white p-4 rounded-3xl border border-gray-50 shadow-sm flex items-center gap-4 transition-colors">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg ${r.value > 140 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                    {MEASUREMENT_TYPES[r.measurementType].emoji}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-gray-800">{MEASUREMENT_TYPES[r.measurementType].label}</p>
                    <p className="text-[10px] font-bold text-gray-400">{r.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black ${r.value > 140 ? 'text-rose-500' : 'text-indigo-500'}`}>{r.value}</p>
                    <p className="text-[8px] font-black text-gray-300 uppercase">mg/dL</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 입력 모달 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal-sheet bg-white rounded-[40px] p-8 max-w-sm mx-auto shadow-2xl">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-xl font-black text-gray-800">혈당 기록</h2>
               <button onClick={() => setShowAddModal(false)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20}/></button>
             </div>
             
             <div className="space-y-6">
                <div className="relative">
                  <input
                    type="number"
                    value={newGlucoseValue}
                    onChange={e => setNewGlucoseValue(e.target.value)}
                    placeholder="000"
                    className="w-full text-5xl font-black text-center py-6 bg-gray-50 rounded-[32px] outline-none text-gray-800 focus:bg-indigo-50/30 transition-colors"
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-gray-300">mg/dL</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(MEASUREMENT_TYPES).map(([key, { label, emoji }]) => (
                    <button
                      key={key}
                      onClick={() => setNewMeasType(key as any)}
                      className={`py-4 rounded-2xl text-xs font-black transition-all border ${
                        newMeasType === key ? 'bg-gray-800 text-white border-gray-800 shadow-lg' : 'bg-white text-gray-400 border-gray-100'
                      }`}
                    >
                      {emoji} {label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-100 text-gray-500 py-5 rounded-[32px] font-black text-sm active:scale-95 transition-all">취소</button>
                  <button
                    onClick={handleAddReading}
                    disabled={!newGlucoseValue || isSubmitting}
                    className="flex-[2] bg-gray-800 text-white py-5 rounded-[32px] font-black text-sm shadow-xl active:scale-95 transition-all disabled:opacity-20"
                  >
                    저장하기
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
