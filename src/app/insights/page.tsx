'use client';

import React, { useState } from 'react';
import { Zap, ChevronRight, CheckCircle, Bell, TrendingUp, Award, Filter } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import type { ActionableInsight } from '@/types';

const DEMO_INSIGHTS: ActionableInsight[] = [
  {
    id: '1',
    type: 'spike_alert',
    title: '🚨 점심 혈당 스파이크 감지',
    message: '점심에 드신 제육볶음의 양념(당류 18g)과 흰밥의 조합으로 혈당이 평소보다 28% 더 올랐습니다. 다음번에는 불고기나 구이류를 선택하시거나, 밥을 현미밥으로 바꿔보세요. 지금 바로 10분 산책을 해보시는 건 어떨까요? 🚶',
    emoji: '🚨',
    actionLabel: '운동 타이머 시작',
    linkedMealId: '2',
    createdAt: new Date(Date.now() - 2 * 3600000),
    isRead: false,
  },
  {
    id: '2',
    type: 'prediction',
    title: '📊 내일 아침 혈당 예측',
    message: '오늘 저녁 식단 분석 결과, 내일 공복 혈당이 90-105 mg/dL 범위로 예상됩니다. 목표 범위 내로 매우 안정적입니다! 현재 저녁 식단 패턴을 유지하세요.',
    emoji: '📊',
    createdAt: new Date(Date.now() - 3 * 3600000),
    isRead: false,
  },
  {
    id: '3',
    type: 'recommendation',
    title: '💡 개인화 식단 추천',
    message: '지난 7일 데이터 분석 결과, 현미밥 + 단백질 반찬 조합에서 혈당이 가장 안정적이었습니다. 특히 된장찌개와 달걀프라이 조합이 당신에게 "Green" 식단입니다. 내일 아침 시도해보세요!',
    emoji: '💡',
    actionLabel: '식단 레시피 보기',
    createdAt: new Date(Date.now() - 5 * 3600000),
    isRead: true,
  },
  {
    id: '4',
    type: 'achievement',
    title: '🏆 3일 연속 목표 달성!',
    message: '3일 연속으로 혈당 목표 범위(70-140 mg/dL)를 85% 이상 유지하셨습니다! 정말 훌륭한 관리입니다. 이 추세라면 이번 달 TIR 목표(80%) 달성이 가능합니다.',
    emoji: '🏆',
    createdAt: new Date(Date.now() - 8 * 3600000),
    isRead: true,
  },
  {
    id: '5',
    type: 'warning',
    title: '⚠️ 저혈당 주의 시간대',
    message: '과거 데이터 패턴상, 오후 4-5시에 혈당이 낮아지는 경향이 있습니다. 이 시간에 견과류나 과일 한 조각의 적당한 간식이 도움이 될 수 있습니다. 단, 당분이 많은 간식은 주의하세요.',
    emoji: '⚠️',
    actionLabel: '간식 추천 보기',
    createdAt: new Date(Date.now() - 24 * 3600000),
    isRead: true,
  },
];

const TYPE_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'spike_alert', label: '스파이크' },
  { key: 'prediction', label: '예측' },
  { key: 'recommendation', label: '추천' },
  { key: 'achievement', label: '달성' },
  { key: 'warning', label: '주의' },
];

const TYPE_COLORS: Record<ActionableInsight['type'], { bg: string; border: string; badge: string }> = {
  spike_alert: { bg: 'from-red-900/30 to-transparent', border: 'border-red-500/20', badge: 'bg-red-500/20 text-red-300' },
  prediction: { bg: 'from-blue-900/30 to-transparent', border: 'border-blue-500/20', badge: 'bg-blue-500/20 text-blue-300' },
  recommendation: { bg: 'from-purple-900/30 to-transparent', border: 'border-purple-500/20', badge: 'bg-purple-500/20 text-purple-300' },
  achievement: { bg: 'from-yellow-900/20 to-transparent', border: 'border-yellow-500/20', badge: 'bg-yellow-500/20 text-yellow-300' },
  warning: { bg: 'from-orange-900/20 to-transparent', border: 'border-orange-500/20', badge: 'bg-orange-500/20 text-orange-300' },
};

const TYPE_LABELS: Record<ActionableInsight['type'], string> = {
  spike_alert: '스파이크',
  prediction: '예측',
  recommendation: '추천',
  achievement: '달성',
  warning: '주의',
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
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 page-content">
      <header className="safe-top px-5 pt-4 pb-3 sticky top-0 bg-gray-950/90 backdrop-blur z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-white">AI 인사이트</h1>
            {unreadCount > 0 && (
              <p className="text-xs text-blue-400">{unreadCount}개의 새 인사이트</p>
            )}
          </div>
          <button className="w-9 h-9 rounded-full glass-card flex items-center justify-center">
            <Filter size={16} className="text-slate-400" />
          </button>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TYPE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeFilter === key
                  ? 'bg-blue-500 text-white'
                  : 'glass-card text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 space-y-3">
        {/* 오늘의 요약 카드 */}
        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-indigo-900 to-blue-900 border border-indigo-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-blue-300" />
            <p className="text-sm font-semibold text-blue-200">오늘의 건강 점수</p>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-5xl font-black text-white">78</p>
            <div>
              <p className="text-emerald-400 text-sm font-medium">+5점 ↑</p>
              <p className="text-slate-400 text-xs">어제보다 향상</p>
            </div>
          </div>
          <div className="mt-3 flex gap-4">
            {[
              { icon: <Zap size={12} />, label: '혈당 관리', score: '82점' },
              { icon: <Award size={12} />, label: '식단 점수', score: '75점' },
              { icon: <Bell size={12} />, label: '기록 완성', score: '90점' },
            ].map(({ icon, label, score }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="text-blue-300">{icon}</div>
                <div>
                  <p className="text-[10px] text-slate-400">{label}</p>
                  <p className="text-xs font-bold text-white">{score}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 인사이트 목록 */}
        {filtered.map(insight => {
          const colors = TYPE_COLORS[insight.type];
          const isExpanded = expandedId === insight.id;

          return (
            <div
              key={insight.id}
              className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colors.bg} ${colors.border} ${
                !insight.isRead ? 'ring-1 ring-blue-500/30' : ''
              }`}
              onClick={() => {
                setExpandedId(isExpanded ? null : insight.id);
                markAsRead(insight.id);
              }}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">{insight.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!insight.isRead && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      )}
                      <p className="text-sm font-semibold text-white leading-snug">{insight.title}</p>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors.badge}`}>
                        {TYPE_LABELS[insight.type]}
                      </span>
                      <span className="text-[10px] text-slate-500">{formatRelativeTime(insight.createdAt)}</span>
                    </div>

                    {/* 미리보기 or 전체 내용 */}
                    <p className={`text-sm text-slate-300 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {insight.message}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>

                {/* 확장 시 액션 버튼 */}
                {isExpanded && insight.actionLabel && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <button className="btn-primary py-2.5 text-sm">
                      {insight.actionLabel}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-slate-400 text-sm">해당 카테고리의 인사이트가 없습니다</p>
          </div>
        )}

        {/* 전체 읽음 처리 */}
        {unreadCount > 0 && (
          <button
            onClick={() => setInsights(prev => prev.map(i => ({ ...i, isRead: true })))}
            className="flex items-center gap-2 text-sm text-slate-400 py-2 mx-auto"
          >
            <CheckCircle size={14} />
            모두 읽음으로 표시
          </button>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
