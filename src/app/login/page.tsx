'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Heart, Activity, Loader2, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.message || '인증에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 page-content relative overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
      {/* 배경 데코레이션 */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-rose-200/40 blur-[80px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] rounded-full bg-indigo-200/40 blur-[80px]" />
      
      <div className="w-full max-w-sm glass-card border border-white p-8 relative z-10 shadow-2xl rounded-[40px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-[var(--color-accent-pink)] to-rose-400 flex items-center justify-center shadow-lg shadow-rose-200 mb-4 animate-bounce">
            <Heart size={32} className="text-white fill-current" />
          </div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">GLUV</h1>
          <p className="text-sm font-bold text-gray-500 mt-1">당신을 위한 스마트 건강 비서</p>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-100 rounded-2xl p-3 text-xs font-bold text-rose-500 text-center animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Mail size={18} />
            </div>
            <input 
              type="email" 
              placeholder="이메일" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-gray-700 outline-none focus:border-rose-300 transition-all shadow-sm"
              required
            />
          </div>

          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Lock size={18} />
            </div>
            <input 
              type="password" 
              placeholder="비밀번호" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-gray-700 outline-none focus:border-rose-300 transition-all shadow-sm"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading || !email || !password}
            className="w-full bg-gray-800 text-white rounded-2xl py-4 font-black shadow-xl shadow-gray-200 active:scale-95 transition-all mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            {isLogin ? '로그인' : '회원가입'}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-gray-100/50">
          <p className="text-xs font-bold text-gray-400 flex items-center justify-center gap-1">
            {isLogin ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'} 
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="ml-1 text-[var(--color-accent-pink)] hover:underline decoration-2 underline-offset-2 transition-all"
            >
              {isLogin ? '무료로 가입하기' : '로그인하기'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
