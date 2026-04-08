'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Zap, ChevronRight, CheckCircle, Bell, TrendingUp, Award, Filter, Sparkles, Heart, Star, Info, Loader2 } from 'lucide-react';
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

export default function InsightsPage() {
  const { user } = useAuth();
  const userId = user?.uid || 'guest';
  const { averageGlucose } = useGlucoseData();
  const [insights, setInsights] = useState<ActionableInsight[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchAIInsights = useCallback(async () => {
    setIsGenerating(true);
    try {
      // 최근 2일 식단 정보 요약 가져오기
      const recentMeals = await getMeals(userId, new Date()); 
      // API Call
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          averageGlucose,
          recentMeals: recentMeals.map(m => m.parsedFoods.map((f: any) => f.name).join(', ')),
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
    } finally {
      setIsGenerating(false);
    }
  }, [userId, averageGlucose]);

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
          <button className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-gray-50 flex items-center justify-center">
            <Filter size={18} className="text-gray-400" />
          </button>
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

      <div className="px-5 space-y-4 pt-2">
        {/* 오늘 아침 특별 카드 */}
        <div className="relative overflow-hidden rounded-[32px] p-6 bg-gradient-to-br from-indigo-500 to-rose-400 shadow-xl shadow-indigo-100 mb-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 blur-2xl animate-pulse" />
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-white" />
            <p className="text-xs font-black text-white/80 uppercase tracking-widest">오늘의 건강 리포트</p>
          </div>
          <div className="flex items-end gap-5">
            <div className="relative">
               <p className="text-6xl font-black text-white tracking-tighter">78</p>
               <span className="absolute -top-1 -right-4 text-xs font-black text-rose-100 bg-rose-500/30 px-2 py-0.5 rounded-full border border-rose-400/30">점</span>
            </div>
            <div className="pb-1.5">
              <div className="flex items-center gap-1 text-emerald-300 font-black text-sm">
                <TrendingUp size={14} /> 5점 올랐어요!
              </div>
              <p className="text-white/60 text-[10px] font-bold">어제보다 더 활기찬 하루예요</p>
            </div>
          </div>
          
          <div className="mt-6 flex gap-3">
             <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex-1 border border-white/10">
                <p className="text-[10px] font-black text-white/50 uppercase mb-1">혈당 관리</p>
                <p className="text-sm font-black text-white">참 잘함 ✨</p>
             </div>
             <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex-1 border border-white/10">
                <p className="text-[10px] font-black text-white/50 uppercase mb-1">식사 기록</p>
                <p className="text-sm font-black text-white">꼼꼼함 💖</p>
             </div>
          </div>
        </div>

        {/* 인사이트 목록 */}
        <div className="space-y-4 pb-10">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest">최근 소식들</h2>
            <button 
              onClick={fetchAIInsights} 
              disabled={isGenerating}
              className="text-[10px] font-black text-[var(--color-accent-pink)] bg-rose-50 px-3 py-1 rounded-full flex items-center gap-1 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              AI 새로고침
            </button>
          </div>
          
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white/40 rounded-[32px] border-2 border-dashed border-gray-100 min-h-[200px] animate-pulse">
               <Loader2 size={32} className="text-[var(--color-accent-pink)] animate-spin mb-4" />
               <p className="text-sm font-black text-gray-500">회원님의 건강 트렌드를 살펴보고 있어요!</p>
               <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">AI 맞춤형 코칭 분석 중...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center animate-in fade-in zoom-in duration-500 bg-white/40 rounded-[32px] border-2 border-dashed border-gray-100">
              <div className="w-20 h-20 bg-gray-50 rounded-[32px] flex items-center justify-center mx-auto mb-6 border border-gray-100">
                 <Star size={32} className="text-gray-200" />
              </div>
              <p className="text-sm font-black text-gray-400">아직 새로운 소식이 없어요!</p>
            </div>
          ) : filtered.map(insight => {
            const colors = TYPE_COLORS[insight.type] || TYPE_COLORS.recommendation;
            const isExpanded = expandedId === insight.id;

            return (
              <div
                key={insight.id}
                className={`group relative overflow-hidden rounded-[32px] transition-all border ${
                  isExpanded ? 'bg-white shadow-xl shadow-gray-100 border-indigo-100' : 'bg-white/60 hover:bg-white shadow-sm border-gray-50'
                }`}
                onClick={() => {
                  setExpandedId(isExpanded ? null : insight.id);
                  markAsRead(insight.id);
                }}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl ${colors.iconBg} flex items-center justify-center text-3xl shadow-inner border border-white group-hover:scale-110 transition-transform`}>
                      {insight.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className={`text-sm font-black text-gray-800 leading-tight ${!insight.isRead ? 'pr-3 relative' : ''}`}>
                          {insight.title}
                          {!insight.isRead && (
                            <span className="absolute right-0 top-1 w-1.5 h-1.5 rounded-full bg-rose-500" />
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full tracking-tighter ${colors.badge}`}>
                          {insight.type === 'spike_alert' ? '혈당 알림' : insight.type === 'prediction' ? '건강 예측' : insight.type === 'achievement' ? '참 잘했어요' : '꿀팁 추천'}
                        </span>
                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">{formatRelativeTime(insight.createdAt)}</span>
                      </div>

                      <p className={`text-sm font-bold text-gray-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {insight.message}
                      </p>
                    </div>
                    <ChevronRight
                      size={20}
                      className={`text-gray-300 flex-shrink-0 transition-all mt-4 ${isExpanded ? 'rotate-90 text-indigo-400' : ''}`}
                    />
                  </div>

                  {/* 확장 시 액션 버튼 */}
                  {isExpanded && insight.actionLabel && (
                    <div className="mt-6 pt-6 border-t border-gray-50 flex justify-end">
                      <button className="bg-gray-800 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-lg shadow-gray-200 active:scale-95 transition-all flex items-center gap-2">
                        {insight.actionLabel} <Star size={14} className="text-yellow-300" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 전체 읽음 처리 */}
        {unreadCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInsights(prev => prev.map(i => ({ ...i, isRead: true })));
            }}
            className="flex items-center justify-center gap-2 text-[10px] font-black text-gray-300 hover:text-rose-400 py-6 transition-colors border-t border-gray-50 mt-4 uppercase tracking-widest"
          >
            <CheckCircle size={14} />
            모든 알림 읽음으로 표시하기
          </button>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
