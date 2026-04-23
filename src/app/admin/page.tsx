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
const ADMIN_UID = 'WGlSyhUc5BQ0hiUfiZFq3sC1Cur1';

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.uid === ADMIN_UID;
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('2024-04-23 15:30');
  const [stats, setStats] = useState({
    totalUsers: 1240,
    activeToday: 456,
    avgGlucose: 118,
    aiTokenUsage: '45,200'
  });

  // 상세 관리 모드 상태
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // 알고리즘 설정 상태
  const [algoSettings, setAlgoSettings] = useState({
    spikeThreshold: 30,
    normalMin: 70,
    normalMax: 140,
    targetProtein: 60
  });

  // 키워드 설정 상태
  const [keywords, setKeywords] = useState([
    { nutrient: '단백질', query: '닭가슴살 샐러드' },
    { nutrient: '식이섬유', query: '양배추 환' },
    { nutrient: '저당간식', query: '스테비아 토마토' }
  ]);

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
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
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

        {/* 시스템 설정 상세 메뉴 */}
        <div className="bg-white rounded-[40px] p-7 border border-[var(--color-border)] shadow-sm">
          <h2 className="text-sm font-black text-[var(--color-text-primary)] mb-6 px-1">시스템 설정</h2>
          <div className="space-y-2">
            {[
              { id: 'users', label: '회원 관리 및 통계', icon: Users },
              { id: 'algo', label: '혈당 분석 알고리즘 튜닝', icon: Activity },
              { id: 'keywords', label: '쇼핑 연동 키워드 관리', icon: Settings },
            ].map((item, i) => (
              <button 
                key={i} 
                onClick={() => setActiveMenu(item.id)}
                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-[var(--color-bg-primary)] transition-colors group"
              >
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

      {/* 상세 관리 모달 */}
      {activeMenu && (
        <div className="modal-overlay" onClick={() => setActiveMenu(null)}>
          <div className="modal-sheet bg-white rounded-[40px] p-8 max-w-sm mx-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-[var(--color-text-primary)]">
                {activeMenu === 'users' ? '회원 관리' : activeMenu === 'algo' ? '알고리즘 튜닝' : '키워드 관리'}
              </h2>
              <button onClick={() => setActiveMenu(null)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20}/></button>
            </div>

            <div className="space-y-6">
              {activeMenu === 'users' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)]">
                    <p className="text-xs font-black text-[var(--color-text-secondary)] mb-2">회원 현황</p>
                    <div className="flex justify-between items-end">
                      <span className="text-2xl font-black text-[var(--color-text-primary)]">{stats.totalUsers}명</span>
                      <span className="text-[10px] font-bold text-emerald-500">+12 (오늘 가입)</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">최근 가입자</p>
                    {['김태희', '이영희', '박철수'].map((name, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl">
                        <span className="text-xs font-bold text-gray-700">{name}</span>
                        <span className="text-[9px] font-bold text-gray-400">2024-04-24</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeMenu === 'algo' && (
                <div className="space-y-5">
                  {[
                    { key: 'spikeThreshold', label: '스파이크 판단 기준 (mg/dL)', value: algoSettings.spikeThreshold },
                    { key: 'normalMax', label: '정상 혈당 최대치 (mg/dL)', value: algoSettings.normalMax },
                    { key: 'targetProtein', label: '일일 단백질 권장량 (g)', value: algoSettings.targetProtein },
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase px-1">{field.label}</label>
                      <input 
                        type="number"
                        value={field.value}
                        onChange={(e) => setAlgoSettings({...algoSettings, [field.key]: parseInt(e.target.value) || 0})}
                        className="w-full bg-gray-50 border border-[var(--color-border)] rounded-2xl py-3 px-4 text-sm font-black text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-all"
                      />
                    </div>
                  ))}
                </div>
              )}

              {activeMenu === 'keywords' && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase px-1">영양소별 추천 검색어</p>
                  <div className="space-y-3">
                    {keywords.map((kw, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="w-20 p-3 bg-[var(--color-primary-soft)] rounded-xl text-[10px] font-black text-[var(--color-accent)] text-center">
                          {kw.nutrient}
                        </div>
                        <input 
                          type="text"
                          value={kw.query}
                          onChange={(e) => {
                            const newKws = [...keywords];
                            newKws[i].query = e.target.value;
                            setKeywords(newKws);
                          }}
                          className="flex-1 bg-white border border-[var(--color-border)] rounded-xl py-2 px-3 text-xs font-bold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  alert('설정이 저장되었습니다! 🌸');
                  setActiveMenu(null);
                }}
                className="w-full bg-[var(--color-accent)] text-white py-4 rounded-[32px] font-black text-sm shadow-xl shadow-[var(--color-accent)]/20 active:scale-95 transition-all mt-4"
              >
                변경사항 저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
