'use client';

import React, { useState } from 'react';
import { Zap, ChevronRight, CheckCircle, Bell, TrendingUp, Award, Filter, Sparkles, Heart, Star, Info } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import type { ActionableInsight } from '@/types';

const DEMO_INSIGHTS: ActionableInsight[] = [
  {
    id: '1',
    type: 'spike_alert',
    title: '🚨 혈당이 조금 놀랐나 봐요!',
    message: '점심에 드신 제육볶음의 달콤한 양념 때문에 혈당이 평소보다 28% 더 기운차게 올라갔어요. 다음번에는 설탕 대신 올리고당을 쓴 불고기를 드셔보거나, 밥을 현미밥으로 반 그릇만 드셔보세요. 지금 바로 저랑 10분만 가볍게 산책할까요? 🚶‍♀️💕',
    emoji: '🚨',
    actionLabel: '10분 산책 타이머 시작',
    linkedMealId: '2',
    createdAt: new Date(Date.now() - 2 * 3600000),
    isRead: false,
  },
  {
    id: '2',
    type: 'prediction',
    title: '📊 내일 아침도 기분 좋게!',
    message: '오늘 저녁 식단을 아주 건강하게 챙겨주셔서, 내일 아침 공복 혈당은 90-105 mg/dL 정도로 아주 예쁘게 나올 것 같아요. 지금처럼만 하면 정말 완벽해요!',
    emoji: '📊',
    createdAt: new Date(Date.now() - 3 * 3600000),
    isRead: false,
  },
  {
    id: '3',
    type: 'recommendation',
    title: '💡 아내분만을 위한 꿀팁',
    message: '지난 일주일 데이터를 보니, 현미밥이랑 달걀후라이를 같이 드실 때 혈당이 제일 얌전했어요. 특히 된장찌개랑 같이 드시는 게 아내분 몸에 가장 잘 맞는 "꿀조합" 식단이에요. 내일 아침 메뉴로 어떠세요?',
    emoji: '💡',
    actionLabel: '추천 레시피 보기',
    createdAt: new Date(Date.now() - 5 * 3600000),
    isRead: true,
  },
  {
    id: '4',
    type: 'achievement',
    title: '🏆 우와! 벌써 3일째예요!',
    message: '3일 연속으로 혈당 목표 범위를 아주 잘 지켜주셨어요! 남편분도 정말 기뻐하실 거예요. 이대로라면 이번 달 목표도 문제없이 달성할 수 있겠어요. 아내분 최고! 👍✨',
    emoji: '🏆',
    createdAt: new Date(Date.now() - 8 * 3600000),
    isRead: true,
  },
  {
    id: '5',
    type: 'warning',
    title: '⚠️ 출출할 때 조심하세요',
    message: '평소에 오후 4시에서 5시 사이가 되면 혈당이 조금 내려가는 편이에요. 이럴 때 당분이 많은 간식보다는 견과류 몇 알이나 사과 한 조각을 드시는 게 아내분 건강을 위해 훨씬 좋아요! 🍎🥜',
    emoji: '⚠️',
    actionLabel: '건강한 간식 추천',
    createdAt: new Date(Date.now() - 24 * 3600000),
    isRead: true,
  },
];

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
  const [insights, setInsights] = useState<ActionableInsight[]>(DEMO_INSIGHTS);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>('1');

  const unreadCount = insights.filter(i => !i.isRead).length;

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
          <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest px-1">최근 소식들</h2>
          
          {filtered.map(insight => {
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

        {filtered.length === 0 && (
          <div className="py-20 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-gray-50 rounded-[32px] flex items-center justify-center mx-auto mb-6 border border-gray-100">
               <Star size={32} className="text-gray-200" />
            </div>
            <p className="text-sm font-black text-gray-400">아직 새로운 소식이 없어요!</p>
            <p className="text-[10px] font-bold text-gray-300 mt-1 uppercase tracking-widest">기다려주시면 예쁜 소식 가져올게요</p>
          </div>
        )}

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
