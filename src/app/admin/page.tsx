'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Zap, Users, Activity, 
  Settings, ChevronRight, Loader2, CheckCircle,
  AlertCircle, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// 관리자 전용 대시보드
export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('2024-04-23 15:30');
  const [stats, setStats] = useState({
    totalUsers: 1240,
    activeToday: 456,
    avgGlucose: 118,
    aiTokenUsage: '45,200'
  });

  // 관리자 권한 체크
  const ADMIN_UID = 'WGlSyhUc5BQ0hiUfiZFq3sC1Cur1';
  const isAdmin = user?.uid === ADMIN_UID; 

  if (!isAdmin && user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg-primary)]">
        <div className="text-center space-y-4">
          <AlertCircle size={48} className="mx-auto text-[var(--color-danger)]" />
          <h2 className="text-xl font-black text-[var(--color-text-primary)]">접근 권한이 없습니다</h2>
          <Link href="/dashboard" className="text-sm font-bold text-[var(--color-accent)] underline">홈으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const handleUpdateAIKnowledge = async () => {
    setIsUpdating(true);
    // 실제로는 여기서 서버 API를 호출하여 AI가 최신 규칙을 생성하고 DB를 업데이트하게 합니다.
    try {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 시뮬레이션
      setLastUpdate(new Date().toLocaleString());
      alert('전체 회원의 백그라운드 AI 지식이 성공적으로 업데이트되었습니다! 🌸');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] pb-20">
      {/* 헤더 */}
      <header className="safe-top px-6 pt-8 pb-4 sticky top-0 bg-[var(--color-bg-primary)]/90 backdrop-blur z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 bg-white rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)]">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tight">GLUV Admin 👑</h1>
            <p className="text-[10px] font-bold text-[var(--color-accent)] mt-0.5 uppercase tracking-widest">System Master Control</p>
          </div>
        </div>
      </header>

      <div className="px-5 space-y-6 pt-4">
        {/* 시스템 요약 */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: '전체 회원', value: stats.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: '오늘 활동', value: stats.activeToday, icon: Activity, color: 'text-[var(--color-accent)]', bg: 'bg-[var(--color-primary-soft)]' },
            { label: '평균 혈당', value: stats.avgGlucose, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
            { label: 'AI 토큰사용', value: stats.aiTokenUsage, icon: Sparkles, color: 'text-indigo-500', bg: 'bg-indigo-50' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-[32px] border border-[var(--color-border)] shadow-sm">
              <div className={`w-8 h-8 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
                <stat.icon size={16} />
              </div>
              <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase mb-1">{stat.label}</p>
              <p className="text-xl font-black text-[var(--color-text-primary)]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* AI 지식 업데이트 제어 센터 */}
        <div className="bg-white rounded-[40px] p-8 border border-[var(--color-border)] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Sparkles size={80} />
          </div>
          
          <div className="relative z-10">
            <h2 className="text-lg font-black text-[var(--color-text-primary)] mb-2">AI 건강 지식 배포</h2>
            <p className="text-xs font-bold text-[var(--color-text-secondary)] leading-relaxed mb-6">
              버튼을 클릭하면 AI가 최신 건강 트렌드와 연구 데이터를 분석하여<br/>
              **전체 회원**의 백그라운드 분석 규칙을 즉시 업데이트합니다.
            </p>

            <div className="p-4 bg-[var(--color-bg-primary)] rounded-3xl border border-[var(--color-border)] mb-8">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-[var(--color-text-muted)]">마지막 배포</span>
                <span className="text-[10px] font-black text-[var(--color-accent)]">SUCCESS</span>
              </div>
              <p className="text-sm font-black text-[var(--color-text-primary)]">{lastUpdate}</p>
            </div>

            <button 
              onClick={handleUpdateAIKnowledge}
              disabled={isUpdating}
              className={`w-full py-5 rounded-[32px] font-black text-sm flex items-center justify-center gap-3 transition-all shadow-xl ${
                isUpdating 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'bg-[var(--color-accent)] text-white shadow-[var(--color-accent)]/20 active:scale-95'
              }`}
            >
              {isUpdating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  글로벌 지식 생성 중...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  AI 지식 즉시 업데이트 및 배포
                </>
              )}
            </button>
          </div>
        </div>

        {/* 기타 관리 메뉴 */}
        <div className="bg-white rounded-[40px] p-7 border border-[var(--color-border)] shadow-sm">
          <h2 className="text-sm font-black text-[var(--color-text-primary)] mb-6 px-1">시스템 설정</h2>
          <div className="space-y-2">
            {[
              { label: '회원 관리 및 통계', icon: Users },
              { label: '혈당 분석 알고리즘 튜닝', icon: Activity },
              { label: '쇼핑 연동 키워드 관리', icon: Settings },
            ].map((item, i) => (
              <button key={i} className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-[var(--color-bg-primary)] transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-[var(--color-accent)] transition-colors">
                    <item.icon size={16} />
                  </div>
                  <span className="text-xs font-bold text-[var(--color-text-secondary)]">{item.label}</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
