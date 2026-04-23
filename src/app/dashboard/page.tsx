'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { 
  Activity, Heart, Flame, Utensils, 
  ChevronRight, SparklesIcon, Moon, Sun
} from '@/components/common/Icons';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';
import GlucoseGauge from '@/components/common/GlucoseGauge';
import { useGlucoseData } from '@/lib/hooks/useGlucoseData';
import { getMeals, getUserProfile, UserProfile } from '@/lib/firebase/firestore';
import type { Meal } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useHealthData } from '@/context/HealthDataContext';

// ==============================
// 커스텀 툴팁
// ==============================
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const color = value > 140 ? 'var(--color-danger)' : value < 70 ? 'var(--color-warning)' : 'var(--color-success)';
    return (
      <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-gray-100 shadow-xl">
        <p className="text-[10px] font-bold text-gray-400 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <p className="font-black text-sm text-gray-700">{value} <span className="text-[10px] font-bold text-gray-400">mg/dL</span></p>
        </div>
      </div>
    );
  }
  return null;
}

export default function DashboardPage() {
  const { 
    meals: todayMeals, 
    userProfile, 
    isLoading: dataLoading,
    refreshData 
  } = useHealthData();
  
  const [latestInsight, setLatestInsight] = useState('오늘도 건강 기록을 남겨보세요! 꾸준한 기록이 건강 관리의 첫 걸음이에요 💕');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

  const { 
    currentGlucose, 
    getChartData, 
    getStatsByPeriod, 
    loading: glucoseLoading 
  } = useGlucoseData();

  const chartData = getChartData(period);
  const stats = getStatsByPeriod(period);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loading = dataLoading || glucoseLoading;

  const now = new Date();
  const getGreeting = () => {
    const h = now.getHours();
    if (h < 6) return { text: '포근한 밤이에요', icon: <Moon size={20} className="text-indigo-400" /> };
    if (h < 12) return { text: '상쾌한 아침이에요', icon: <Sun size={20} className="text-amber-400" /> };
    if (h < 18) return { text: '따사로운 오후예요', icon: <Sun size={20} className="text-orange-400" /> };
    return { text: '편안한 저녁이에요', icon: <Moon size={20} className="text-rose-400" /> };
  };

  const greeting = isMounted ? getGreeting() : { text: '안녕하세요', icon: <Sun size={20} className="text-amber-400" /> };
  const totalCalories = todayMeals.reduce((s, m) => s + m.totalCalories, 0);
  const totalCarbs = todayMeals.reduce((s, m) => s + m.totalCarbs, 0);

  if (!isMounted) return <div className="min-h-screen bg-[var(--color-bg-primary)] page-content"></div>;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] page-content">
      <PageHeader
        title="GLUV"
        showBranding={true}
        subtitle={greeting.text}
      />

      <div className="px-5 space-y-6 pt-4">
        {/* 기간 선택 탭 */}
        <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-[var(--color-border)] w-fit mx-auto shadow-sm">
          {[
            { id: 'day', label: '일간' },
            { id: 'week', label: '주간' },
            { id: 'month', label: '월간' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setPeriod(t.id as any)}
              className={`px-6 py-2 rounded-xl text-[11px] font-black transition-all ${
                period === t.id 
                  ? 'bg-[var(--color-accent)] text-white shadow-md' 
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 현재 혈당 게이지 카드 (빨간 박스 영역 개편) */}
        <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--color-primary-soft)] rounded-full -mr-24 -mt-24 opacity-30 blur-3xl" />
          <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] text-center mb-8">
            {period === 'day' ? '오늘' : period === 'week' ? '이번 주' : '이번 달'} 평균 혈당
          </p>
          
          <GlucoseGauge value={stats.avg} loading={loading} />
          
          {/* 최대/최소 수치 표시 */}
          <div className="mt-8 flex items-center justify-center gap-12">
            <div className="text-center">
              <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase mb-1">MAX</p>
              <p className="text-lg font-black text-[var(--color-accent)]">{stats.max || '-'}</p>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="text-center">
              <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase mb-1">MIN</p>
              <p className="text-lg font-black text-[var(--color-warning)]">{stats.min || '-'}</p>
            </div>
          </div>
        </div>

        {/* 오늘 통계 및 추이 그래프 (파란 박스 영역 개편) */}
        <div className="bg-white rounded-[40px] p-6 shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-8 px-1">
            <h2 className="font-black text-[var(--color-text-primary)] text-sm flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[var(--color-accent)] rounded-full" />
              혈당 변화 추이
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
              <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Trend View</span>
            </div>
          </div>

          <div className="h-48 min-w-0 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
                <defs>
                  <linearGradient id="glucoseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" stroke="#fcf2f4" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: '#B7A5A5', fontSize: 9, fontWeight: '800' }} tickLine={false} axisLine={false} dy={10} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#B7A5A5', fontSize: 9, fontWeight: '800' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="glucose"
                  stroke="var(--color-accent)"
                  strokeWidth={4}
                  fill="url(#glucoseGrad)"
                  dot={{ r: 4, fill: 'white', stroke: 'var(--color-accent)', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: 'var(--color-accent)', stroke: 'white', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 주요 지표 퀵 뷰 */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-[var(--color-bg-primary)] p-4 rounded-3xl border border-[var(--color-border)]">
              <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase mb-1">목표 범위 내</p>
              <p className="text-lg font-black text-[var(--color-text-primary)]">{timeInRange}%</p>
            </div>
            <div className="bg-[var(--color-bg-primary)] p-4 rounded-3xl border border-[var(--color-border)]">
              <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase mb-1">섭취 칼로리</p>
              <p className="text-lg font-black text-[var(--color-text-primary)]">{totalCalories} <span className="text-[10px]">kcal</span></p>
            </div>
          </div>
        </div>

        {/* AI 인사이트 배너 */}
        <Link href="/insights">
          <div className="relative overflow-hidden rounded-[32px] p-6 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 animate-bounce-slow">
                <SparklesIcon size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-white/70 mb-1 uppercase tracking-widest">오늘의 따뜻한 조언</p>
                <p className="text-sm font-bold text-white leading-relaxed">{latestInsight}</p>
              </div>
              <ChevronRight size={18} className="text-white/50 flex-shrink-0 mt-1" />
            </div>
          </div>
        </Link>

        {/* 오늘 식사 기록 요약 */}
        <div className="pb-8">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="font-black text-[var(--color-text-primary)] text-sm flex items-center gap-2">
               <span className="w-1.5 h-4 bg-[var(--color-accent)] rounded-full mr-1" />
              오늘 드신 것들
            </h2>
            <Link href="/meals" className="text-[10px] font-bold text-[var(--color-accent)] bg-[var(--color-primary-soft)] px-2 py-1 rounded-lg">
              기록 보기
            </Link>
          </div>
          <div className="space-y-3">
            {todayMeals.length === 0 ? (
              <div className="py-12 bg-white/40 rounded-[32px] border-2 border-dashed border-gray-100 flex flex-col items-center gap-2">
                <span className="text-4xl">🍳</span>
                <p className="text-xs font-bold text-gray-400">아직 식사 기록이 없어요!</p>
              </div>
            ) : (
              todayMeals.slice(0, 3).map(meal => (
                <div key={meal.id} className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 flex items-center gap-4 group hover:border-rose-100 transition-all">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-white ${
                    meal.glucotypeScore === 'green' ? 'bg-emerald-50 text-emerald-500' :
                    meal.glucotypeScore === 'yellow' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-500'
                  }`}>
                    {meal.glucotypeScore === 'green' ? '👍' : meal.glucotypeScore === 'yellow' ? '🤏' : '⚠️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-800 truncate">
                      {meal.parsedFoods.map(f => f.name).join(', ')}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                      {meal.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} · {meal.totalCalories} kcal
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                    meal.glucotypeScore === 'green' ? 'bg-emerald-50 text-emerald-600' :
                    meal.glucotypeScore === 'yellow' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-500'
                  }`}>
                    {meal.glucotypeScore === 'green' ? '좋아요' : meal.glucotypeScore === 'yellow' ? '적당해요' : '주의해요'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="pt-8 pb-12 text-center">
          <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">GLUV Healthy Life Assistant</p>
          <p className="text-[9px] font-bold text-gray-300">© 2026 DongHyeok Choi. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
