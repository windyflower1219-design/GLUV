'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Zap, ChevronRight, CheckCircle, Bell, TrendingUp, Award, Sparkles, Heart, Star, Info, Loader2 } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import type { ActionableInsight } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlucoseData } from '@/lib/hooks/useGlucoseData';
import { getMeals } from '@/lib/firebase/firestore';

const TYPE_FILTERS = [
  { key: 'all', label: '전체보기' },
  { key: 'spike_alert', label: '알림' },
  { key: 'prediction', label: '예측' },
  { key: 'recommendation', label: '추천' },
  { key: 'achievement', label: '칭찬' },
];

const TYPE_COLORS: Record<ActionableInsight['type'], { bg: string; iconBg: string; text: string; badge: string }> = {
  spike_alert: { bg: 'bg-rose-50', iconBg: 'bg-rose-100', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-600' },
  prediction: { bg: 'bg-indigo-50', iconBg: 'bg-indigo-100', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-600' },
  recommendation: { bg: 'bg-amber-50', iconBg: 'bg-amber-100', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  achievement: { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-600' },
  warning: { bg: 'bg-orange-50', iconBg: 'bg-orange-100', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-600' },
};

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor(diffMs / 60000);
  if (diffH >= 24) return `${Math.floor(diffH / 24)}일 전`;
  if (diffH >= 1) return `${diffH}시간 전`;
  return `${diffM}분 전`;
}

import { useHealthData } from '@/context/HealthDataContext';

export default function InsightsPage() {
  const { user } = useAuth();
  const userId = user?.uid || 'guest';
  const { averageGlucose } = useGlucoseData();
  const { meals: recentMealsData } = useHealthData();
  const [insights, setInsights] = useState<ActionableInsight[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // 데이터 기반 인사이트 분석 엔진 (AI 없이 동작)
  const dataDrivenInsights = React.useMemo(() => {
    if (!recentMealsData.length || !glucoseReadings.length) return null;

    // 1. 혈당 변화 분석 (식후 30분~2시간 사이의 변동폭 측정)
    const foodCorrelations: Record<string, { spikes: number[], counts: number }> = {};
    
    recentMealsData.forEach(meal => {
      const mealTime = meal.timestamp.getTime();
      // 식후 2시간 이내의 최고 혈당 찾기
      const postMealReadings = glucoseReadings.filter(r => {
        const diff = r.timestamp.getTime() - mealTime;
        return diff > 0 && diff <= 2 * 60 * 60 * 1000;
      });

      if (postMealReadings.length > 0) {
        // 식전 혈당 (가장 가까운 과거 기록)
        const preMealReading = glucoseReadings
          .filter(r => r.timestamp.getTime() <= mealTime)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        const baseLine = preMealReading ? preMealReading.value : 100;
        const maxReading = Math.max(...postMealReadings.map(r => r.value));
        const spike = maxReading - baseLine;

        meal.parsedFoods.forEach(food => {
          if (!food.name) return;
          if (!foodCorrelations[food.name]) foodCorrelations[food.name] = { spikes: [], counts: 0 };
          foodCorrelations[food.name].spikes.push(spike);
          foodCorrelations[food.name].counts += 1;
        });
      }
    });

    // 평균 스파이크 계산 및 정렬
    const foodInsights = Object.entries(foodCorrelations)
      .map(([name, data]) => ({
        name,
        avgSpike: data.spikes.reduce((a, b) => a + b, 0) / data.spikes.length,
        count: data.counts
      }))
      .filter(f => f.count >= 1);

    const worstFoods = [...foodInsights].sort((a, b) => b.avgSpike - a.avgSpike).slice(0, 3);
    const bestFoods = [...foodInsights].sort((a, b) => a.avgSpike - b.avgSpike).slice(0, 3);

    // 2. 영양소 분석
    const totals = { carbs: 0, protein: 0, fat: 0, calories: 0, sodium: 0 };
    recentMealsData.slice(0, 10).forEach(m => { // 최근 10끼니 분석
      m.parsedFoods.forEach(f => {
        totals.carbs += f.carbs || 0;
        totals.protein += f.protein || 0;
        totals.fat += f.fat || 0;
        totals.calories += f.calories || 0;
        totals.sodium += f.sodium || 0;
      });
    });
    
    const avg = {
      carbs: totals.carbs / 10,
      protein: totals.protein / 10,
      fat: totals.fat / 10,
    };

    const deficiencies = [];
    if (avg.protein < 20) deficiencies.push({ name: '단백질', reason: '근육 유지와 혈당 안정에 중요해요', query: '저당 고단백 식품' });
    // 식이섬유는 데이터에 없으므로 채소류 권장으로 대체
    if (recentMealsData.filter(m => m.rawText.includes('채소') || m.rawText.includes('샐러드')).length < 3) {
      deficiencies.push({ name: '식이섬유', reason: '혈당 흡수를 늦춰주는 역할을 해요', query: '신선한 샐러드 채소' });
    }

    // 3. 운동 추천 로직
    let exerciseRec = { type: '산책', duration: '20분', reason: '식후 가벼운 움직임이 혈당 스파이크를 막아줍니다.' };
    if (averageGlucose > 150) {
      exerciseRec = { type: '빠르게 걷기', duration: '40분', reason: '현재 평균 혈당이 다소 높습니다. 유산소 운동이 필요해요.' };
    }

    return { worstFoods, bestFoods, deficiencies, exerciseRec };
  }, [recentMealsData, glucoseReadings, averageGlucose]);

  const fetchAIInsights = useCallback(async () => {
    // ... 기존 AI 로직 (규칙 업데이트 등으로 활용 가능)

  // 처음 들어왔을 때 인사이트가 비어있으면 생성
  useEffect(() => {
    if (insights.length === 0) {
      fetchAIInsights();
    }
  }, [insights.length, fetchAIInsights]);

  const unreadCount = insights.filter((i) => !i.isRead).length;

  const filtered = activeFilter === 'all'
    ? insights
    : insights.filter(i => i.type === activeFilter);

  const markAsRead = (id: string) => {
    setInsights(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] page-content">
      <header className="safe-top px-6 pt-6 pb-3 sticky top-0 bg-[var(--color-bg-primary)]/90 backdrop-blur z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">당신을 위한 조언</h1>
            {unreadCount > 0 && (
              <p className="text-xs font-bold text-rose-500 mt-0.5">{unreadCount}개의 새로운 소식이 있어요!</p>
            )}
          </div>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {TYPE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all border ${
                activeFilter === key
                  ? 'bg-gray-800 text-white border-gray-800 shadow-lg shadow-gray-200'
                  : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-5 space-y-6 pt-2 pb-10">
        {/* 데이터 기반 분석 섹션 */}
        {dataDrivenInsights && (
          <div className="space-y-6">
            {/* 1. 혈당 유발 vs 안전 음식 */}
            <div className="bg-white rounded-[40px] p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center">
                  <TrendingUp size={16} className="text-rose-500" />
                </div>
                <h2 className="text-sm font-black text-gray-800">음식별 혈당 영향도</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-1">주의가 필요해요</p>
                  {dataDrivenInsights.worstFoods.length > 0 ? dataDrivenInsights.worstFoods.map(f => (
                    <div key={f.name} className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100/50">
                      <p className="text-xs font-black text-gray-700 truncate">{f.name}</p>
                      <p className="text-[9px] font-bold text-rose-500 mt-1">평균 +{Math.round(f.avgSpike)} mg/dL</p>
                    </div>
                  )) : <p className="text-[10px] text-gray-400 px-1">데이터 부족</p>}
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest px-1">부담 없는 선택</p>
                  {dataDrivenInsights.bestFoods.length > 0 ? dataDrivenInsights.bestFoods.map(f => (
                    <div key={f.name} className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50">
                      <p className="text-xs font-black text-gray-700 truncate">{f.name}</p>
                      <p className="text-[9px] font-bold text-emerald-600 mt-1">변화 거의 없음 ✨</p>
                    </div>
                  )) : <p className="text-[10px] text-gray-400 px-1">데이터 부족</p>}
                </div>
              </div>
            </div>

            {/* 2. 영양학 분석 & 쇼핑 링크 */}
            <div className="bg-white rounded-[40px] p-6 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Heart size={16} className="text-indigo-500" />
                </div>
                <h2 className="text-sm font-black text-gray-800">부족한 영양소 분석</h2>
              </div>

              <div className="space-y-4">
                {dataDrivenInsights.deficiencies.length > 0 ? dataDrivenInsights.deficiencies.map(d => (
                  <div key={d.name} className="bg-gray-50 rounded-3xl p-5 border border-gray-100">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-sm font-black text-gray-800">{d.name} 섭취가 적어요</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-1">{d.reason}</p>
                      </div>
                      <span className="text-2xl">🥗</span>
                    </div>
                    <div className="flex gap-2">
                      <a 
                        href={`https://www.coupang.com/np/search?q=${encodeURIComponent(d.query)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-white border border-gray-200 py-2.5 rounded-xl text-[10px] font-black text-gray-600 text-center hover:bg-gray-50 transition-colors"
                      >
                        쿠팡 검색
                      </a>
                      <a 
                        href={`https://www.kurly.com/search?keyword=${encodeURIComponent(d.query)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-white border border-gray-200 py-2.5 rounded-xl text-[10px] font-black text-gray-600 text-center hover:bg-gray-50 transition-colors"
                      >
                        마켓컬리 검색
                      </a>
                    </div>
                  </div>
                )) : (
                  <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100 text-center">
                    <p className="text-xs font-black text-indigo-600">영양 밸런스가 아주 훌륭합니다! 🌈</p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. 운동 가이드 */}
            <div className="bg-gray-800 rounded-[40px] p-7 shadow-xl shadow-gray-200 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Zap size={80} strokeWidth={3} />
              </div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <Zap size={16} className="text-amber-400" />
                </div>
                <h2 className="text-sm font-black text-white/80 uppercase tracking-widest">오늘의 권장 운동</h2>
              </div>
              
              <div className="relative z-10">
                <h3 className="text-2xl font-black mb-2">{dataDrivenInsights.exerciseRec.type} {dataDrivenInsights.exerciseRec.duration}</h3>
                <p className="text-xs font-bold text-white/50 leading-relaxed max-w-[80%]">
                  {dataDrivenInsights.exerciseRec.reason}
                </p>
                <button className="mt-6 bg-white text-gray-800 px-6 py-3 rounded-2xl text-[11px] font-black hover:bg-indigo-50 transition-colors">
                  운동 시작하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI 보조 인사이트 (기존) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest">AI 추가 코칭</h2>
            <button 
              onClick={fetchAIInsights} 
              disabled={isGenerating}
              className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full flex items-center gap-1 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              AI 분석 업데이트
            </button>
          </div>
          
          {insights.slice(0, 3).map(insight => {
            const colors = TYPE_COLORS[insight.type] || TYPE_COLORS.recommendation;
            return (
              <div key={insight.id} className="bg-white/60 rounded-[32px] p-5 border border-gray-50 flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl ${colors.iconBg} flex items-center justify-center text-2xl border border-white flex-shrink-0`}>
                  {insight.emoji}
                </div>
                <div>
                  <p className="text-sm font-black text-gray-800 mb-1">{insight.title}</p>
                  <p className="text-xs font-bold text-gray-500 leading-relaxed">{insight.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
