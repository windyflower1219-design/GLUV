'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, Target, Flame, Heart, 
  ChevronRight, LogOut, Loader2, Save, Sparkles
} from '@/components/common/Icons';
import PageHeader from '@/components/common/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { getUserProfile, updateUserProfile, UserProfile } from '@/lib/firebase/firestore';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const data = await getUserProfile(user.uid);
        setProfile(data);
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  const handleUpdate = async () => {
    if (!user || !profile) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateUserProfile(user.uid, profile);
      setMessage({ text: '설정이 저장되었습니다! ✨', type: 'success' });
      // 다른 페이지의 캐시 동기화를 위해 이벤트 발송
      window.dispatchEvent(new CustomEvent('record-saved'));
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ text: '저장에 실패했습니다. 다시 시도해 주세요.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('정말 로그아웃 하시겠습니까?')) {
      await logout();
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <Loader2 className="animate-spin text-rose-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] page-content">
      <PageHeader title="내 정보 설정" />

      <div className="px-5 space-y-6 pt-4 pb-24">
        {/* 사용자 정보 카드 */}
        <div className="bg-white rounded-[40px] p-6 shadow-sm border border-gray-50 flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 flex items-center justify-center text-3xl shadow-inner border border-white">
            👤
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-gray-800">{user?.displayName || '사용자'}님</h2>
            <p className="text-xs font-bold text-gray-400 mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* 목표 설정 섹션 */}
        <div className="space-y-4">
          <p className="text-xs font-black text-gray-400 px-1 flex items-center gap-1 uppercase tracking-widest">
             <Target size={12} /> 나의 목표 설정
          </p>

          <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-50 space-y-8">
            {/* 목표 칼로리 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black text-gray-700 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                    <Flame size={16} className="text-orange-500" />
                  </div>
                  하루 목표 칼로리
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={profile?.targetKcal}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, targetKcal: parseInt(e.target.value) || 0 } : null)}
                    className="w-20 text-right font-black text-orange-500 bg-transparent outline-none border-b-2 border-transparent focus:border-orange-200"
                  />
                  <span className="text-xs font-bold text-gray-400">kcal</span>
                </div>
              </div>
              <p className="text-[10px] font-bold text-gray-400 ml-10">권장: 성인 기준 약 2,000 ~ 2,500 kcal</p>
            </div>

            <div className="h-px bg-gray-50" />

            {/* 목표 혈당 범위 */}
            <div className="space-y-6">
              <label className="text-sm font-black text-gray-700 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Heart size={16} className="text-indigo-500" />
                </div>
                안전 혈당 목표 범위
              </label>
              
              <div className="flex items-center justify-between gap-4 pl-10">
                <div className="flex-1 space-y-2">
                  <p className="text-[10px] font-black text-gray-400 text-center uppercase tracking-tighter">최소(공복)</p>
                  <div className="bg-gray-50 rounded-2xl p-3 flex items-center justify-center gap-1 border border-gray-100">
                    <input
                      type="number"
                      value={profile?.targetGlucoseMin}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, targetGlucoseMin: parseInt(e.target.value) || 0 } : null)}
                      className="w-12 text-center font-black text-gray-700 bg-transparent outline-none"
                    />
                    <span className="text-[10px] font-bold text-gray-400">mg/dL</span>
                  </div>
                </div>
                <div className="w-4 h-px bg-gray-200 mt-6" />
                <div className="flex-1 space-y-2">
                  <p className="text-[10px] font-black text-gray-400 text-center uppercase tracking-tighter">최대(식후)</p>
                  <div className="bg-gray-50 rounded-2xl p-3 flex items-center justify-center gap-1 border border-gray-100">
                    <input
                      type="number"
                      value={profile?.targetGlucoseMax}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, targetGlucoseMax: parseInt(e.target.value) || 0 } : null)}
                      className="w-12 text-center font-black text-gray-700 bg-transparent outline-none"
                    />
                    <span className="text-[10px] font-bold text-gray-400">mg/dL</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] font-bold text-gray-400 ml-10">일반적인 권장 범위는 70 ~ 140 mg/dL 입니다.</p>
            </div>
          </div>
        </div>

        {/* 메시지 표시 */}
        {message && (
          <div className={`p-4 rounded-2xl text-center text-xs font-black animate-fade-in ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
          }`}>
            {message.text}
          </div>
        )}

        {/* 저장 버튼 */}
        <button
          onClick={handleUpdate}
          disabled={saving}
          className="w-full bg-gray-800 text-white py-5 rounded-[32px] font-black text-sm shadow-xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          목표 설정 저장하기
        </button>

        <div className="h-4" />

        {/* 기타 액션 */}
        <div className="bg-white rounded-[40px] overflow-hidden shadow-sm border border-gray-50">
          <button
            onClick={handleLogout}
            className="w-full px-6 py-5 flex items-center justify-between hover:bg-rose-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center">
                <LogOut size={18} className="text-rose-400" />
              </div>
              <span className="text-sm font-bold text-gray-700 group-hover:text-rose-500">로그아웃</span>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </button>
        </div>

        {/* 하단 캡션 */}
        <p className="text-center text-[10px] font-bold text-gray-300">
          GLUV v1.2.0 · 건강한 변화의 시작 ✨
        </p>
      </div>
    </div>
  );
}
