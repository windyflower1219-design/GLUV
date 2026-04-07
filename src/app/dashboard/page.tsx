'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity, TrendingUp, TrendingDown, Minus,
  Droplets, Flame, Zap, ChevronRight, Bell,
  Target, Award, Heart, Coffee, Moon, Sun, Utensils
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import BottomNavigation from '@/components/BottomNavigation';
import VoiceInputModal from '@/components/VoiceInputModal';
import { useGlucoseData } from '@/lib/hooks/useGlucoseData';
import { getMeals } from '@/lib/firebase/firestore';
import { predictGlucoseResponse } from '@/lib/algorithms/glucoseAnalysis';
import type { FoodItem, Meal } from '@/types';

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

// ==============================
// 오늘의 요약 통계 카드
// ==============================
interface StatCardProps {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

function StatCard({ label, value, unit, icon, color, bg }: StatCardProps) {
  return (
    <div className="bg-white rounded-[32px] p-5 flex-1 shadow-sm border border-gray-50 hover:border-rose-100 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-2xl ${bg} ${color} flex items-center justify-center shadow-inner border border-white group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center">
          <ChevronRight size={12} className="text-gray-300" />
        </div>
      </div>
      <div className="space-y-1">
        <p className={`text-2xl font-black ${color}`}>{value}</p>
        <div className="flex items-baseline gap-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
          <span className="text-[9px] font-medium text-gray-300">{unit}</span>
        </div>
      </div>
    </div>
  );
}

// ==============================
// 혈당 상태 게이지 (더 귀엽고 따뜻한 버전)
// ==============================
function GlucoseGauge({ value, targetMin = 70, targetMax = 140 }: { value: number; targetMin?: number; targetMax?: number }) {
  const isHigh = value > targetMax;
  const isLow = value < targetMin;
  
  const config = isHigh 
    ? { label: '조금 높아요!', color: 'text-rose-500', bg: 'bg-rose-50', icon: '🍰' }
    : isLow 
    ? { label: '낮은 편이에요!', color: 'text-amber-600', bg: 'bg-amber-50', icon: '🍎' }
    : { label: '참 잘하고 있어요!', color: 'text-emerald-500', bg: 'bg-emerald-50', icon: '✨' };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* 장식용 배경 원 */}
        <div className="absolute inset-0 rounded-full border-8 border-gray-50 shadow-inner" />
        <div className="absolute inset-4 rounded-full border-2 border-dashed border-gray-100 animate-spin-slow" />
        
        {/* 수치 표시 */}
        <div className="relative z-10 text-center">
          <span className="text-4xl block mb-1">{config.icon}</span>
          <p className="text-5xl font-black text-gray-800 tracking-tighter">{value}</p>
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1">mg / dL</p>
        </div>

        {/* 게이지 바 (SVG) */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={isHigh ? '#fda4af' : isLow ? '#fde68a' : '#6ee7b7'}
            strokeWidth="8"
            strokeDasharray={`${Math.min(276, (value / 300) * 276)} 276`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
      </div>
      
      <div className={`mt-6 px-6 py-2 rounded-2xl ${config.bg} ${config.color} shadow-sm border border-white flex items-center gap-2`}>
        <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        <p className="text-xs font-black">{config.label}</p>
      </div>
    </div>
  );
}

// ==============================
// 메인 대시보드 페이지
// ==============================
export default function DashboardPage() {
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [latestInsight] = useState('어제보다 혈당 관리가 안정적이에요! 남편분이 정성껏 준비한 저녁 식사 덕분일까요? 오늘도 화이팅! 💕');

  const { currentGlucose, averageGlucose, timeInRange, getChartData, loading, fetchReadings } = useGlucoseData('demo');
  const chartData = getChartData();

  const fetchTodayData = useCallback(async () => {
    try {
      const meals = await getMeals('demo', new Date());
      setTodayMeals(meals);
    } catch (error) {
      console.error('Error fetching today data:', error);
    }
  }, []);

  useEffect(() => {
    fetchTodayData();
  }, [fetchTodayData]);

  const handleMealConfirm = useCallback(async () => {
    await fetchTodayData();
    setShowVoiceModal(false);
  }, [fetchTodayData]);

  const now = new Date();
  const getGreeting = () => {
    const h = now.getHours();
    if (h < 6) return { text: '포근한 밤이에요', icon: <Moon size={20} className="text-indigo-400" /> };
    if (h < 12) return { text: '상쾌한 아침이에요', icon: <Sun size={20} className="text-amber-400" /> };
    if (h < 18) return { text: '따사로운 오후예요', icon: <Sun size={20} className="text-orange-400" /> };
    return { text: '편안한 저녁이에요', icon: <Moon size={20} className="text-rose-400" /> };
  };

  const greeting = getGreeting();
  const totalCalories = todayMeals.reduce((s, m) => s + m.totalCalories, 0);
  const totalCarbs = todayMeals.reduce((s, m) => s + m.totalCarbs, 0);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] page-content">
      {/* 상단 헤더 */}
      <header className="safe-top px-6 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-gray-50">
               {greeting.icon}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400">{greeting.text} 👋</p>
              <div className="flex items-baseline gap-2">
                <h1 className="text-2xl font-black text-gray-800 tracking-tighter">GLUV</h1>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-400 leading-none">Glucose + View</span>
                  <span className="text-[7px] font-medium text-rose-300 leading-none mt-1 uppercase tracking-tighter">for YR Lee</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/insights" className="relative w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-gray-50 active:scale-90 transition-all">
              <Bell size={20} className="text-gray-400" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            </Link>
          </div>
        </div>
      </header>

      <div className="px-5 space-y-5 pt-4">

        {/* 현재 혈당 게이지 카드 */}
        <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16 opacity-50" />
          <p className="text-xs font-black text-gray-300 uppercase tracking-widest text-center mb-8">현재 우리 아내 혈당</p>
          {loading ? (
            <div className="skeleton w-48 h-48 rounded-full mx-auto" />
          ) : (
            <GlucoseGauge value={currentGlucose} />
          )}
          <div className="flex items-center justify-center gap-2 mt-8 py-2 px-4 bg-gray-50/50 rounded-2xl w-fit mx-auto border border-gray-50">
             <span className="w-1 h-1 rounded-full bg-gray-300" />
             <p className="text-[10px] font-bold text-gray-400">
               {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 측정됨
             </p>
          </div>
        </div>

        {/* 오늘 통계 빠른 보기 */}
        <div className="flex gap-4">
          <StatCard
            label="오늘 평균"
            value={averageGlucose || '-'}
            unit="mg/dL"
            icon={<Activity size={20} />}
            color="text-indigo-500"
            bg="bg-indigo-50"
          />
          <StatCard
            label="목표 도달"
            value={timeInRange || '-'}
            unit="%"
            icon={<Heart size={20} />}
            color="text-rose-500"
            bg="bg-rose-50"
          />
        </div>

        <div className="flex gap-4">
          <StatCard
            label="섭취 칼로리"
            value={totalCalories.toLocaleString()}
            unit="kcal"
            icon={<Flame size={20} />}
            color="text-orange-500"
            bg="bg-orange-50"
          />
          <StatCard
            label="탄수화물"
            value={totalCarbs}
            unit="g"
            icon={<Utensils size={20} />}
            color="text-amber-500"
            bg="bg-amber-50"
          />
        </div>

        {/* AI 인사이트 배너 */}
        <Link href="/insights">
          <div className="relative overflow-hidden rounded-[32px] p-6 bg-gradient-to-br from-indigo-600 to-rose-400 shadow-lg shadow-indigo-100">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 animate-bounce-slow">
                <Sparkles size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-white/70 mb-1 uppercase tracking-widest">오늘의 따뜻한 조언</p>
                <p className="text-sm font-bold text-white leading-relaxed">{latestInsight}</p>
              </div>
              <ChevronRight size={18} className="text-white/50 flex-shrink-0 mt-1" />
            </div>
          </div>
        </Link>

        {/* 혈당 추이 차트 */}
        <div className="bg-white rounded-[40px] p-6 shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-6 px-1">
            <h2 className="font-black text-gray-800 text-sm flex items-center gap-2">
              <span className="w-1.5 h-4 bg-indigo-400 rounded-full mr-1" />
              혈당 변화 그래프
            </h2>
            <Link href="/glucose" className="text-[10px] font-bold text-indigo-400 bg-indigo-50 px-2 py-1 rounded-lg">
              자세히 보기
            </Link>
          </div>
          <div className="h-40 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
                <defs>
                  <linearGradient id="glucoseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" stroke="#f8fafc" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} tickLine={false} axisLine={false} dy={5} />
                <YAxis domain={[60, 200]} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} tickLine={false} axisLine={false} />
                <ReferenceLine y={140} stroke="#fda4af" strokeDasharray="4 4" />
                <ReferenceLine y={70} stroke="#fde68a" strokeDasharray="4 4" />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="glucose"
                  stroke="#818cf8"
                  strokeWidth={3}
                  fill="url(#glucoseGrad)"
                  dot={{ r: 4, fill: 'white', stroke: '#818cf8', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 오늘 식사 기록 요약 */}
        <div className="pb-4">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="font-black text-gray-800 text-sm flex items-center gap-2">
               <span className="w-1.5 h-4 bg-rose-400 rounded-full mr-1" />
              오늘 드신 것들
            </h2>
            <Link href="/meals" className="text-[10px] font-bold text-rose-400 bg-rose-50 px-2 py-1 rounded-lg">
              기집 보기
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
      </div>

      {/* 플로팅 마이크 버튼 */}
      <button
        onClick={() => setShowVoiceModal(true)}
        className="fab-mic bg-gray-800 shadow-xl shadow-gray-200"
        aria-label="오늘 뭐 드셨나요?"
      >
        <Mic size={28} className="text-white" />
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

// 헬퍼 컴포넌트 & 아이콘
const Sparkles = ({ size, className }: { size: number; className: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" /><path d="M3 5h4" /><path d="M19 17v4" /><path d="M17 19h4" />
  </svg>
);

const Mic = ({ size, className }: { size: number; className: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);
