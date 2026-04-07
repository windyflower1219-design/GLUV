'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity, TrendingUp, TrendingDown, Minus,
  Droplets, Flame, Zap, ChevronRight, Bell,
  Target, Award
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import BottomNavigation from '@/components/BottomNavigation';
import VoiceInputModal from '@/components/VoiceInputModal';
import { useGlucoseData } from '@/lib/hooks/useGlucoseData';
import { predictGlucoseResponse } from '@/lib/algorithms/glucoseAnalysis';
import type { FoodItem } from '@/types';

// ==============================
// 커스텀 툴팁
// ==============================
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const color = value > 140 ? '#ef4444' : value < 70 ? '#f59e0b' : '#10b981';
    return (
      <div className="glass-card px-3 py-2">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-bold" style={{ color }}>{value} mg/dL</p>
      </div>
    );
  }
  return null;
}

// ==============================
// 오늘의 요약 통계 카드
// ==============================
interface StatCardProps {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'stable';
}

function StatCard({ label, value, unit, icon, color, trend }: StatCardProps) {
  return (
    <div className="glass-card p-4 flex-1">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-xl ${color}`}>
          {icon}
        </div>
        {trend === 'up' && <TrendingUp size={14} className="text-red-400" />}
        {trend === 'down' && <TrendingDown size={14} className="text-green-400" />}
        {trend === 'stable' && <Minus size={14} className="text-slate-400" />}
      </div>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <p className="text-xs text-slate-500">{unit}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

// ==============================
// 혈당 상태 게이지
// ==============================
function GlucoseGauge({ value, targetMin = 70, targetMax = 140 }: { value: number; targetMin?: number; targetMax?: number }) {
  const isHigh = value > targetMax;
  const isLow = value < targetMin;
  const isNormal = !isHigh && !isLow;

  const statusConfig = {
    normal: { label: '정상 범위', color: '#10b981', glow: 'glow-green', bgColor: 'bg-emerald-500/20' },
    high: { label: '목표 초과', color: '#ef4444', glow: 'glow-red', bgColor: 'bg-red-500/20' },
    low: { label: '저혈당 주의', color: '#f59e0b', glow: 'glow-yellow', bgColor: 'bg-yellow-500/20' },
  };

  const config = isHigh ? statusConfig.high : isLow ? statusConfig.low : statusConfig.normal;

  // 게이지 각도 계산 (0-300mg/dL 범위를 -150° ~ 150° 에 매핑)
  const clampedValue = Math.min(300, Math.max(0, value));
  const angle = (clampedValue / 300) * 270 - 135;

  return (
    <div className="flex flex-col items-center">
      <div className={`relative w-40 h-40 ${config.glow}`} style={{ filter: `drop-shadow(0 0 20px ${config.color}40)` }}>
        {/* SVG 게이지 */}
        <svg viewBox="0 0 120 120" className="w-full h-full">
          {/* 배경 트랙 */}
          <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10"
            strokeDasharray="226 75" strokeDashoffset="-37" strokeLinecap="round" />
          {/* 정상 범위 표시 */}
          <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(16,185,129,0.2)" strokeWidth="10"
            strokeDasharray="110 191" strokeDashoffset="-100" strokeLinecap="round" />
          {/* 현재 값 */}
          <circle cx="60" cy="60" r="48" fill="none" stroke={config.color} strokeWidth="10"
            strokeDasharray={`${(clampedValue / 300) * 226} 301`}
            strokeDashoffset="-37" strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
          {/* 중앙 텍스트 */}
          <text x="60" y="55" textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="Inter">
            {value}
          </text>
          <text x="60" y="70" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="9" fontFamily="Inter">
            mg/dL
          </text>
        </svg>
      </div>
      <div className={`mt-2 px-4 py-1.5 rounded-full ${config.bgColor}`}>
        <p className="text-sm font-semibold" style={{ color: config.color }}>{config.label}</p>
      </div>
    </div>
  );
}

// ==============================
// 메인 대시보드 페이지
// ==============================
export default function DashboardPage() {
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [recentMeals, setRecentMeals] = useState<Array<{
    id: string;
    name: string;
    time: string;
    calories: number;
    glucotype: 'green' | 'yellow' | 'red';
    insight?: string;
  }>>([
    { id: '1', name: '아침 - 현미밥, 된장찌개', time: '08:30', calories: 420, glucotype: 'green', insight: '혈당 안정적 ✅' },
    { id: '2', name: '점심 - 제육볶음, 밥', time: '12:15', calories: 650, glucotype: 'yellow', insight: '식후 산책 권장 💛' },
    { id: '3', name: '저녁 - 김치찌개, 밥', time: '18:45', calories: 480, glucotype: 'green', insight: '목표 범위 유지 ✅' },
  ]);

  const [latestInsight] = useState('점심에 드신 제육볶음의 양념으로 혈당이 평소보다 18% 상승했습니다. 저녁 식사 전 10분 산책을 추천드려요! 🚶');

  const { currentGlucose, averageGlucose, timeInRange, getChartData, loading } = useGlucoseData('demo_user');
  const chartData = getChartData();

  const handleMealConfirm = useCallback((foods: Partial<FoodItem>[], rawText: string) => {
    const totalCals = foods.reduce((sum, f) => sum + (f.calories ?? 0) * (f.quantity ?? 1), 0);
    const prediction = predictGlucoseResponse(foods as FoodItem[], currentGlucose);

    const mealTypeLabels: Record<string, string> = {
      green: '안전 ✅',
      yellow: '주의 💛',
      red: '위험 🚨',
    };

    setRecentMeals(prev => [{
      id: Date.now().toString(),
      name: `방금 - ${foods.map(f => f.name).join(', ')}`,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      calories: Math.round(totalCals),
      glucotype: prediction.riskLevel,
      insight: mealTypeLabels[prediction.riskLevel],
    }, ...prev]);
  }, [currentGlucose]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? '좋은 아침이에요' : now.getHours() < 18 ? '좋은 오후예요' : '좋은 저녁이에요';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-blue-950/20 to-gray-950 page-content">
      {/* 상단 헤더 */}
      <header className="safe-top px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">{greeting} 👋</p>
            <h1 className="text-xl font-bold gradient-text-blue">GLUV</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/insights" className="relative w-10 h-10 rounded-full glass-card flex items-center justify-center">
              <Bell size={18} className="text-slate-300" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            </Link>
          </div>
        </div>
      </header>

      <div className="px-4 space-y-4">

        {/* 현재 혈당 게이지 */}
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-slate-400 mb-4">현재 혈당</p>
          {loading ? (
            <div className="skeleton w-40 h-40 rounded-full mx-auto" />
          ) : (
            <GlucoseGauge value={currentGlucose} />
          )}
          <p className="text-xs text-slate-500 mt-3">
            {new Date().toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준 측정
          </p>
        </div>

        {/* 오늘 통계 빠른 보기 */}
        <div className="flex gap-3">
          <StatCard
            label="평균 혈당"
            value={averageGlucose || '--'}
            unit="mg/dL 오늘"
            icon={<Activity size={16} className="text-blue-400" />}
            color="bg-blue-500/20"
            trend="stable"
          />
          <StatCard
            label="목표 범위율"
            value={timeInRange || '--'}
            unit="% TIR"
            icon={<Target size={16} className="text-emerald-400" />}
            color="bg-emerald-500/20"
            trend={timeInRange >= 70 ? 'down' : 'up'}
          />
        </div>

        <div className="flex gap-3">
          <StatCard
            label="오늘 칼로리"
            value="1,550"
            unit="kcal / 2,000"
            icon={<Flame size={16} className="text-orange-400" />}
            color="bg-orange-500/20"
            trend="stable"
          />
          <StatCard
            label="탄수화물"
            value="158"
            unit="g / 250g"
            icon={<Zap size={16} className="text-yellow-400" />}
            color="bg-yellow-500/20"
            trend="up"
          />
        </div>

        {/* 혈당 추이 차트 */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white text-sm">오늘 혈당 추이</h2>
            <Link href="/glucose" className="text-xs text-blue-400 flex items-center gap-0.5">
              전체 보기 <ChevronRight size={14} />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="glucoseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis domain={[60, 200]} tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
              <ReferenceLine y={140} stroke="rgba(239,68,68,0.3)" strokeDasharray="4 4" />
              <ReferenceLine y={70} stroke="rgba(245,158,11,0.3)" strokeDasharray="4 4" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="glucose"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#glucoseGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* AI 인사이트 배너 */}
        <Link href="/insights">
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-purple-900/60 to-blue-900/60 border border-purple-500/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl" />
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/30 flex items-center justify-center flex-shrink-0">
                <Zap size={20} className="text-purple-300" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-purple-300 mb-1">💡 AI 인사이트</p>
                <p className="text-sm text-slate-200 leading-relaxed">{latestInsight}</p>
              </div>
              <ChevronRight size={16} className="text-slate-400 flex-shrink-0 mt-1" />
            </div>
          </div>
        </Link>

        {/* 오늘 식사 기록 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white text-sm">오늘의 식사</h2>
            <Link href="/meals" className="text-xs text-blue-400 flex items-center gap-0.5">
              모두 보기 <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentMeals.slice(0, 3).map(meal => (
              <div key={meal.id} className="glass-card glass-card-hover p-3 flex items-center gap-3">
                <div className={`w-2 h-10 rounded-full ${
                  meal.glucotype === 'green' ? 'bg-emerald-500' :
                  meal.glucotype === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{meal.name}</p>
                  <p className="text-xs text-slate-400">{meal.time} · {meal.calories}kcal</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                  meal.glucotype === 'green' ? 'glucotype-green' :
                  meal.glucotype === 'yellow' ? 'glucotype-yellow' : 'glucotype-red'
                }`}>
                  {meal.insight}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 주간 목표 달성도 */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-yellow-400" />
            <h2 className="font-semibold text-white text-sm">이번 주 목표 달성</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: '혈당 목표 범위 유지', value: 72, color: 'from-emerald-500 to-teal-400' },
              { label: '식사 기록 완성', value: 85, color: 'from-blue-500 to-purple-500' },
              { label: '산책 목표 달성', value: 60, color: 'from-orange-500 to-yellow-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className="text-xs font-semibold text-white">{value}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${color}`}
                    style={{ width: `${value}%`, transition: 'width 1s ease' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 플로팅 마이크 버튼 */}
      <button
        onClick={() => setShowVoiceModal(true)}
        className="fab-mic"
        aria-label="음식 음성 기록"
      >
        <Droplets size={28} className="text-white" />
      </button>

      {/* 음성 입력 모달 */}
      {showVoiceModal && (
        <VoiceInputModal
          onClose={() => setShowVoiceModal(false)}
          onConfirm={handleMealConfirm}
        />
      )}

      <BottomNavigation />
    </div>
  );
}
