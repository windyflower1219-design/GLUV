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
  const { meals: recentMealsData, glucoseReadings } = useHealthData();
  const [insights, setInsights] = useState<ActionableInsight[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // 데이터 기반 인사이트 분석 엔진 (AI 없이 동작)
  const dataDrivenInsights = React.useMemo(() => {
    if (!recentMealsData.length || !glucoseReadings.length) return null;

    // 1. 혈당 변화 분석
    const foodCorrelations: Record<string, { spikes: number[], counts: number }> = {};
    
    recentMealsData.forEach(meal => {
      const mealTime = meal.timestamp.getTime();
      const postMealReadings = glucoseReadings.filter(r => {
        const diff = r.timestamp.getTime() - mealTime;
        return diff > 0 && diff <= 2 * 60 * 60 * 1000;
      });

      if (postMealReadings.length > 0) {
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

    const foodInsights = Object.entries(foodCorrelations)
      .map(([name, data]) => ({
        name,
        avgSpike: data.spikes.reduce((a, b) => a + b, 0) / data.spikes.length,
        count: data.counts
      }))
      .filter(f => f.count >= 1);

    const worstFoods = [...foodInsights].sort((a, b) => b.avgSpike - a.avgSpike).slice(0, 3);
    const bestFoods = [...foodInsights].sort((a, b) => a.avgSpike - b.avgSpike).slice(0, 3);

    // 2. 영양소 정밀 분석 (수치 포함)
    const totals = { carbs: 0, protein: 0, fat: 0, calories: 0, sodium: 0 };
    const analysisDays = 7;
    const recentWeekMeals = recentMealsData.filter(m => {
      const diff = Date.now() - m.timestamp.getTime();
      return diff <= analysisDays * 24 * 60 * 60 * 1000;
    });

    recentWeekMeals.forEach(m => {
      m.parsedFoods.forEach(f => {
        totals.carbs += f.carbs || 0;
        totals.protein += f.protein || 0;
        totals.fat += f.fat || 0;
        totals.calories += f.calories || 0;
        totals.sodium += f.sodium || 0;
      });
    });
    
    // 일평균 섭취량 계산
    const avg = {
      protein: totals.protein / analysisDays,
      carbs: totals.carbs / analysisDays,
    };

    // 목표치 (가정: 단백질 60g, 하루 3끼 기준 한 끼당 20g)
    const targetProtein = 60;
    const deficiencies = [];
    
    if (avg.protein < targetProtein) {
      deficiencies.push({ 
        name: '단백질', 
        current: Math.round(avg.protein),
        target: targetProtein,
        unit: 'g',
        reason: `하루 평균 ${Math.round(targetProtein - avg.protein)}g이 부족해요. 근육 유지와 혈당 안정에 필수적입니다.`, 
        query: '고단백 식단 추천' 
      });
    }

    const veggieCount = recentWeekMeals.filter(m => 
      m.rawVoiceInput?.includes('채소') || m.rawVoiceInput?.includes('샐러드') || m.rawVoiceInput?.includes('쌈')
    ).length;

    if (veggieCount < 5) { // 주 5회 미만 채소 섭취 시
      deficiencies.push({ 
        name: '식이섬유', 
        current: veggieCount,
        target: 7,
        unit: '회',
        reason: `채소 섭취가 주 ${5 - veggieCount}회 더 필요해요. 식이섬유는 당 흡수를 늦춰줍니다.`, 
        query: '신선한 샐러드 배송' 
      });
    }

    // 3. 운동 추천 & 유튜브 연동
    let exerciseRec = { 
      type: '가벼운 산책', 
      duration: '20분', 
      reason: '식후 가벼운 움직임이 혈당 스파이크를 효과적으로 막아줍니다.',
      ytQuery: '식후 20분 걷기 효과'
    };
    
    if (averageGlucose > 140) {
      exerciseRec = { 
        type: '빠르게 걷기', 
        duration: '40분', 
        reason: '최근 평균 혈당이 높습니다. 에너지 소비량을 늘려 혈당을 낮춰야 해요.',
        ytQuery: '당뇨 혈당 낮추는 운동'
      };
    }

    return { worstFoods, bestFoods, deficiencies, exerciseRec };
  }, [recentMealsData, glucoseReadings, averageGlucose]);

  const fetchAIInsights = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          averageGlucose,
          recentMeals: recentMealsData.map(m => m.parsedFoods.map((f: any) => f.name).join(', ')),
          isDemo: userId === 'guest'
        }),
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      
      const mapped = (data.insights || []).map((ins: any) => ({
        ...ins,
        createdAt: new Date(),
        isRead: false
      }));
      setInsights(mapped);
      if (mapped.length > 0) setExpandedId(mapped[0].id);
    } catch (err) {
      console.error(err);
      const fallback: ActionableInsight[] = [
        {
          id: 'fallback_1',
          type: 'recommendation',
          title: '💧 물 충분히 마시기',
          message: '혈당 관리에 수분 섭취는 필수입니다. 하루 1.5L~2L 정도 충분히 마셔보세요!',
          emoji: '💧',
          createdAt: new Date(),
          isRead: false,
        },
      ];
      setInsights(fallback);
    } finally {
      setIsGenerating(false);
    }
  }, [userId, averageGlucose, recentMealsData]);

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
      <header className="safe-top px-6 pt-8 pb-4 sticky top-0 bg-[var(--color-bg-primary)]/90 backdrop-blur z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tight">GLUV 핑크 리포트 🎀</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">AI 지식 기반 맞춤 분석 중</p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-5 space-y-6 pt-2 pb-10">
        {/* 1. AI 생성 인사이트 섹션 (누락되었던 부분 복구) */}
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 rounded-[40px] border border-dashed border-gray-100">
            <Loader2 size={32} className="text-[var(--color-accent)] animate-spin mb-4" />
            <p className="text-xs font-black text-gray-400">AI가 당신의 건강 데이터를 정밀 분석 중...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map((insight) => (
              <div 
                key={insight.id}
                className={`bg-white rounded-[32px] p-6 shadow-sm border border-gray-50 relative overflow-hidden transition-all ${expandedId === insight.id ? 'ring-2 ring-[var(--color-primary-soft)]' : ''}`}
                onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${TYPE_COLORS[insight.type].bg}`}>
                    {insight.emoji || '✨'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${TYPE_COLORS[insight.type].badge}`}>
                        {TYPE_FILTERS.find(f => f.key === insight.type)?.label || '분석'}
                      </span>
                      <p className="text-[9px] font-bold text-gray-300">{formatRelativeTime(insight.createdAt)}</p>
                    </div>
                    <h3 className="text-sm font-black text-[var(--color-text-primary)]">{insight.title}</h3>
                    <p className={`text-[11px] font-bold text-[var(--color-text-secondary)] leading-relaxed mt-2 ${expandedId === insight.id ? '' : 'line-clamp-1'}`}>
                      {insight.message}
                    </p>
                  </div>
                  <ChevronRight size={16} className={`text-gray-300 mt-1 transition-transform ${expandedId === insight.id ? 'rotate-90' : ''}`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. 데이터 기반 심층 분석 섹션 */}
        {dataDrivenInsights ? (
          <div className="space-y-6">
            {/* 혈당 민감 음식 분석 */}
            <div className="bg-white rounded-[40px] p-7 shadow-sm border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-9 h-9 rounded-2xl bg-[var(--color-primary-soft)] flex items-center justify-center">
                  <TrendingUp size={18} className="text-[var(--color-accent)]" />
                </div>
                <h2 className="text-base font-black text-[var(--color-text-primary)]">내 혈당에 민감한 음식들</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 px-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger)]" />
                    <p className="text-[11px] font-black text-[var(--color-text-secondary)] uppercase tracking-wider">주의할까요?</p>
                  </div>
                  {dataDrivenInsights.worstFoods.length > 0 ? dataDrivenInsights.worstFoods.map(f => (
                    <div key={f.name} className="bg-[#FFF5F6] p-4 rounded-3xl border border-[#FFE8EB]">
                      <p className="text-xs font-black text-[var(--color-text-primary)] truncate">{f.name}</p>
                      <p className="text-[10px] font-bold text-[var(--color-accent)] mt-1.5">평균 +{Math.round(f.avgSpike)} mg/dL</p>
                    </div>
                  )) : <p className="text-[10px] text-gray-300 px-1">기록이 부족해요</p>}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 px-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                    <p className="text-[11px] font-black text-[var(--color-text-secondary)] uppercase tracking-wider">부담 없어요</p>
                  </div>
                  {dataDrivenInsights.bestFoods.length > 0 ? dataDrivenInsights.bestFoods.map(f => (
                    <div key={f.name} className="bg-[#F6FFF9] p-4 rounded-3xl border border-[#E8FFEF]">
                      <p className="text-xs font-black text-[var(--color-text-primary)] truncate">{f.name}</p>
                      <p className="text-[10px] font-bold text-emerald-500 mt-1.5">안전함 ✨</p>
                    </div>
                  )) : <p className="text-[10px] text-gray-300 px-1">기록이 부족해요</p>}
                </div>
              </div>
            </div>

            {/* 영양학 분석 */}
            <div className="bg-white rounded-[40px] p-7 shadow-sm border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-9 h-9 rounded-2xl bg-[var(--color-primary-soft)] flex items-center justify-center">
                  <Heart size={18} className="text-[var(--color-accent)]" />
                </div>
                <h2 className="text-base font-black text-[var(--color-text-primary)]">부족한 영양소 보충하기</h2>
              </div>

              <div className="space-y-5">
                {dataDrivenInsights.deficiencies.length > 0 ? dataDrivenInsights.deficiencies.map(d => (
                  <div key={d.name} className="bg-[var(--color-bg-primary)] rounded-[32px] p-6 border border-[var(--color-border)]">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <p className="text-base font-black text-[var(--color-text-primary)]">{d.name}</p>
                           <span className="text-[10px] font-black bg-[var(--color-accent)] text-white px-2 py-0.5 rounded-full">CHECK!</span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-1">
                          <p className="text-sm font-black text-[var(--color-accent)]">{d.current}{d.unit}</p>
                          <p className="text-[10px] font-bold text-[var(--color-text-muted)]">/ 목표 {d.target}{d.unit}</p>
                        </div>
                      </div>
                      <span className="text-3xl">🥯</span>
                    </div>
                    
                    <div className="bg-white/60 p-4 rounded-2xl mb-5">
                       <p className="text-[11px] font-bold text-[var(--color-text-secondary)] leading-relaxed">{d.reason}</p>
                    </div>

                    <div className="flex gap-2.5">
                      <a href={`https://www.coupang.com/np/search?q=${encodeURIComponent(d.query)}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white border border-gray-100 py-3 rounded-2xl text-[11px] font-black text-center shadow-sm">쿠팡</a>
                      <a href={`https://www.kurly.com/search?keyword=${encodeURIComponent(d.query)}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white border border-gray-100 py-3 rounded-2xl text-[11px] font-black text-center shadow-sm">컬리</a>
                    </div>
                  </div>
                )) : (
                  <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 text-center">
                    <p className="text-xs font-black text-emerald-600">영양 밸런스가 아주 훌륭해요! 🌸</p>
                  </div>
                )}
              </div>
            </div>

            {/* 운동 가이드 */}
            <div className="bg-[#5F4B4B] rounded-[40px] p-8 shadow-xl shadow-[#FFB7C5]/20 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Zap size={100} strokeWidth={3} />
              </div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Zap size={18} className="text-[var(--color-primary)]" />
                </div>
                <h2 className="text-sm font-black text-white/70 uppercase tracking-widest">최신 추천 운동</h2>
              </div>
              <h3 className="text-2xl font-black mb-3">{dataDrivenInsights.exerciseRec.type} {dataDrivenInsights.exerciseRec.duration}</h3>
              <p className="text-[11px] font-bold text-white/50 leading-relaxed max-w-[85%] mb-8">{dataDrivenInsights.exerciseRec.reason}</p>
              <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(dataDrivenInsights.exerciseRec.ytQuery)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white px-7 py-3.5 rounded-2xl text-xs font-black shadow-lg">
                <Sparkles size={14} /> 유튜브 가이드
              </a>
            </div>
          </div>
        ) : !isGenerating && (
          <div className="py-20 text-center bg-white rounded-[40px] border border-gray-100">
            <p className="text-xs font-bold text-gray-400">분석을 위한 데이터가 조금 더 필요해요! 📊</p>
          </div>
        )}

        {/* 3. 하단으로 이동한 AI 건강 지침 상태 바 (빨간 박스) */}
        <div className="bg-white/80 rounded-3xl p-4 border border-[var(--color-border)] flex items-center justify-between shadow-sm mt-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center">
              <Sparkles size={14} className="text-[var(--color-accent)]" />
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--color-text-primary)]">AI 건강 지침 동기화 완료</p>
              <p className="text-[9px] font-bold text-[var(--color-text-muted)]">최종 업데이트: 2026. 4. 24. (v2.4)</p>
            </div>
          </div>
          <div className="px-3 py-1 bg-[var(--color-bg-primary)] rounded-full border border-[var(--color-border)]">
             <p className="text-[9px] font-black text-[var(--color-accent)]">최신상태</p>
          </div>
        </div>

        {/* 4. 간소화된 분석 근거 문구 (파란 박스) */}
        <div className="pt-4 pb-12 text-center">
           <p className="text-[10px] font-black text-[var(--color-text-muted)] tracking-tight">
             관리자 검증 AI 규칙 기반 맞춤형 로컬 분석
           </p>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
