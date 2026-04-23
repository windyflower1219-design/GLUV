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
    addReading, editReading, removeReading, getChartData, fetchReadings,
  } = useGlucoseData();

  // 날짜 선택 바용 미리 계산된 날짜 목록
  const dateOffsets = React.useMemo(() => {
    return [-3, -2, -1, 0, 1, 2, 3].map(offset => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d;
    });
  }, []);

  // 선택된 날짜에 따른 필터링된 데이터
  const filteredReadings = React.useMemo(() => {
    if (period !== 'day') return readings;
    return readings.filter(r => 
      r.timestamp.toDateString() === selectedDate.toDateString()
    );
  }, [readings, period, selectedDate]);

  // 필터링된 데이터 기반 지표 재계산 (오늘 하루 탭일 때만)
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

  // 차트 데이터 필터링 (기간별 대응)
  const chartData = React.useMemo(() => {
    if (period === 'day') {
      return filteredReadings
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        .map(r => ({
          time: r.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          glucose: r.value,
        }));
    }
    return getChartData(); // week/month는 기존 로직 활용
  }, [filteredReadings, period, getChartData]);

  const weeklyAnalysis = analyzeWeeklyTrend(readings);

  // 편집/삭제 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editType, setEditType] = useState<GlucoseReading['measurementType']>('random');
  const [editTime, setEditTime] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 삭제 확인 → 편집 모드 → 추가 모달 순으로 우선 소비 (LIFO 역순)
  useBackHandler(() => {
    if (confirmDeleteId) { setConfirmDeleteId(null); return true; }
    return false;
  }, !!confirmDeleteId);

  useBackHandler(() => {
    if (editingId) {
      setEditingId(null);
      setEditValue('');
      setEditTime('');
      return true;
    }
    return false;
  }, !!editingId);

  useBackHandler(() => {
    if (showAddModal) { setShowAddModal(false); return true; }
    return false;
  }, showAddModal);

  const startEdit = (reading: GlucoseReading) => {
    const tzoffset = reading.timestamp.getTimezoneOffset() * 60000;
    const isoLocal = new Date(reading.timestamp.getTime() - tzoffset).toISOString().slice(0, 16);
    setEditingId(reading.id);
    setEditValue(String(reading.value));
    setEditType(reading.measurementType);
    setEditTime(isoLocal);
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
    setEditTime('');
  };

  const saveEdit = async (reading: GlucoseReading) => {
    const val = parseInt(editValue);
    if (isNaN(val) || val < 20 || val > 600) {
      alert('혈당 값은 20~600 mg/dL 범위여야 합니다.');
      return;
    }
    try {
      await editReading(reading.id, {
        value: val,
        measurementType: editType,
        timestamp: editTime ? new Date(editTime) : reading.timestamp,
      });
      cancelEdit();
      window.dispatchEvent(new CustomEvent('record-saved'));
    } catch (err: any) {
      alert(`수정에 실패했습니다: ${err?.message || err}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeReading(id);
      setConfirmDeleteId(null);
      window.dispatchEvent(new CustomEvent('record-saved'));
    } catch (err: any) {
      alert(`삭제에 실패했습니다: ${err?.message || err}`);
    }
  };

  useEffect(() => {
    // 전역 저장 이벤트 리스너
    const handleRefresh = () => fetchReadings();
    window.addEventListener('record-saved', handleRefresh);
    return () => window.removeEventListener('record-saved', handleRefresh);
  }, [fetchReadings]);

  const handleAddReading = async () => {
    const value = parseInt(newGlucoseValue);
    if (isNaN(value) || value < 20 || value > 600) return;
    try {
      await addReading(value, newMeasType, new Date(selectedTime));
      setNewGlucoseValue('');
      setShowAddModal(false);
    } catch (error: any) {
      alert(`저장에 실패했습니다: ${error.message || error}`);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] page-content">
      <PageHeader 
        title="혈당 리포트" 
        rightElement={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[var(--color-accent-pink)] text-white text-sm font-black shadow-lg shadow-rose-100 active:scale-95 transition-all"
          >
            <Plus size={18} strokeWidth={3} /> 기록하기
          </button>
        }
      />

      <div className="px-4 space-y-5 pt-4">
        {/* 기간 탭 (기존 헤더에 있던 것을 본문으로 이동시켜 더 깔끔하게 처리) */}
        <div className="flex gap-1 p-1 rounded-2xl bg-white border border-[var(--color-border)] shadow-sm">
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

        {/* 기간별 날짜 선택 바 (오늘 하루 탭일 때만 노출) */}
        {period === 'day' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {dateOffsets.map(d => {
              const isSelected = selectedDate.toDateString() === d.toDateString();
              const isToday = new Date().toDateString() === d.toDateString();
              return (
                <div key={d.toISOString()}
                  onClick={() => setSelectedDate(d)}
                  className={`flex flex-col items-center px-3 py-2 rounded-2xl min-w-[56px] cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-[var(--color-accent-pink)] text-white shadow-lg scale-105' 
                      : 'bg-white text-[var(--color-text-secondary)] border border-[var(--color-border)]'
                  }`}
                >
                  <span className="text-[10px] font-bold opacity-80">
                    {d.toLocaleDateString('ko-KR', { weekday: 'short' })}
                  </span>
                  <span className="text-lg font-extrabold">
                    {d.getDate()}
                  </span>
                  {isToday && !isSelected && <div className="w-1 h-1 rounded-full bg-[var(--color-accent-pink)] mt-0.5" />}
                </div>
              );
            })}
          </div>
        )}

        {/* 핵심 지표 카드 3개 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="현재 혈당"
            value={loading ? '-' : currentGlucose}
            unit="mg/dL"
            icon={<Activity size={16} />}
            color="text-rose-500"
            bg="bg-rose-50"
            variant="center"
          />
          <StatCard
            label="평균 혈당"
            value={loading ? '-' : displayAverage}
            unit="mg/dL"
            icon={<Target size={16} />}
            color="text-indigo-500"
            bg="bg-indigo-50"
            variant="center"
          />
          <StatCard
            label="목표 범위"
            value={loading ? '-' : displayTimeInRange}
            unit="%"
            icon={<Heart size={16} />}
            color="text-emerald-500"
            bg="bg-emerald-50"
            variant="center"
          />
        </div>

        {/* 메인 차트 */}
        <div className="glass-card p-5 border-none shadow-sm relative overflow-hidden bg-white/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-black text-gray-800 text-sm flex items-center gap-2">
               <span className="w-1.5 h-4 bg-[var(--color-accent-pink)] rounded-full mr-1" />
              {period === 'day' 
                ? (selectedDate.toDateString() === new Date().toDateString() ? '오늘 하루 흐름' : `${selectedDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 기록`)
                : period === 'week' ? '한 주간의 기록' : '한 달간의 기록'}
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
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} tickLine={false} axisLine={false} dy={10} />
                <YAxis domain={[50, 200]} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} tickLine={false} axisLine={false} />
                <ReferenceLine y={140} stroke="#fda4af" strokeWidth={1} strokeDasharray="4 4" />
                <ReferenceLine y={70} stroke="#ca8a04" strokeWidth={1} strokeDasharray="4 4" />
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
              {period === 'day' ? '이날의 기록' : '최근 혈당 기록'}
            </h2>
          </div>
          
          <div className="space-y-3">
            {loading ? (
              <div className="h-16 skeleton rounded-3xl" />
            ) : filteredReadings.length === 0 ? (
              <div className="py-12 bg-white/40 rounded-[32px] border-2 border-dashed border-gray-100 flex flex-col items-center gap-2">
                <span className="text-4xl">💧</span>
                <p className="text-xs font-bold text-gray-400">아직 입력된 기록이 없어요!</p>
              </div>
            ) : filteredReadings.slice().reverse().map(reading => {
              const isHigh = reading.value > 140;
              const isLow = reading.value < 70;
              const type = MEASUREMENT_TYPES[reading.measurementType];
              const isEditing = editingId === reading.id;
              const isConfirmingDelete = confirmDeleteId === reading.id;

              return (
                <div
                  key={reading.id}
                  className={`bg-white rounded-3xl p-4 shadow-sm border group transition-colors ${
                    isEditing ? 'border-indigo-200' : 'border-[var(--color-border)] hover:border-indigo-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-white ${
                      isHigh ? 'bg-rose-50 text-rose-500' : isLow ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {type.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
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
                    {!isEditing && !isConfirmingDelete && (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          onClick={() => startEdit(reading)}
                          className="p-2 text-indigo-300 hover:text-indigo-500 transition-colors"
                          aria-label="수정"
                          title="수정"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(reading.id); setEditingId(null); }}
                          className="p-2 text-rose-300 hover:text-rose-500 transition-colors"
                          aria-label="삭제"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 편집 폼 */}
                  {isEditing && (
                    <div className="mt-4 pt-4 border-t border-gray-50 space-y-3 animate-fade-in">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-gray-400">혈당 (mg/dL)</span>
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full bg-white border border-gray-100 rounded-lg px-2 py-2 text-sm font-black text-gray-700 outline-none focus:border-indigo-300"
                            min={20}
                            max={600}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-gray-400">측정 시간</span>
                          <input
                            type="datetime-local"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                            className="w-full bg-white border border-gray-100 rounded-lg px-2 py-2 text-[11px] font-bold text-gray-700 outline-none focus:border-indigo-300"
                          />
                        </label>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 mb-2">측정 시점</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(Object.entries(MEASUREMENT_TYPES) as Array<[GlucoseReading['measurementType'], { label: string; order: number; emoji: string }]>)
                            .sort((a, b) => a[1].order - b[1].order)
                            .map(([key, { label, emoji }]) => (
                              <button
                                key={key}
                                onClick={() => setEditType(key)}
                                className={`py-2 px-2 rounded-xl text-[11px] font-black transition-all border flex items-center justify-center gap-1 ${
                                  editType === key
                                    ? 'bg-gray-800 text-white border-gray-800'
                                    : 'bg-white text-gray-400 border-gray-100'
                                }`}
                              >
                                <span>{emoji}</span> {label}
                              </button>
                            ))}
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEdit}
                          disabled={isSubmitting}
                          className="flex items-center gap-1 text-[11px] font-black text-gray-500 bg-gray-100 px-3 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                        >
                          <X size={12} /> 취소
                        </button>
                        <button
                          onClick={() => saveEdit(reading)}
                          disabled={isSubmitting || !editValue}
                          className="flex items-center gap-1 text-[11px] font-black text-white bg-indigo-500 px-3 py-2 rounded-xl active:scale-95 transition-all shadow-sm shadow-indigo-100 disabled:opacity-50"
                        >
                          {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          저장
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 삭제 확인 */}
                  {isConfirmingDelete && (
                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 justify-end animate-fade-in bg-rose-50/40 -mx-4 -mb-4 px-4 py-3 rounded-b-3xl">
                      <p className="text-xs font-bold text-rose-500 mr-auto">이 기록을 삭제할까요?</p>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={isSubmitting}
                        className="text-[11px] font-black text-gray-500 bg-gray-100 px-3 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleDelete(reading.id)}
                        disabled={isSubmitting}
                        className="flex items-center gap-1 text-[11px] font-black text-white bg-rose-500 px-3 py-2 rounded-xl active:scale-95 transition-all shadow-sm shadow-rose-100 disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        삭제
                      </button>
                    </div>
                  )}
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

            <div className="mb-6 bg-white border border-gray-100 rounded-3xl p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
                  <Clock size={14} className="text-gray-400" />
                </div>
                <span className="text-xs font-black text-gray-600">측정 시간</span>
              </div>
              <input 
                type="datetime-local" 
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="text-xs font-bold text-gray-800 bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-indigo-400"
              />
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
                  <span className="flex items-center gap-2">저장 중... <Loader2 size={16} className="animate-spin" /></span>
                ) : (
                  <>기록 완료 <ChevronRight size={18} strokeWidth={3} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
