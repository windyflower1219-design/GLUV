'use client';

import React from 'react';
import { Sparkles } from './Icons';

interface LoadingScreenProps {
  isVisible: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isVisible }) => {
  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--color-bg-primary)] transition-all duration-1000 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* 배경 장식 애니메이션 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[var(--color-primary-soft)] rounded-full blur-[100px] animate-pulse opacity-60" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--color-bg-secondary)] rounded-full blur-[120px] animate-pulse opacity-50" style={{ animationDelay: '700ms' }} />
      </div>

      {/* 메인 로딩 콘텐츠 */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-12">
          {/* 퍼지는 물방울 효과 */}
          <div className="absolute inset-0 bg-[var(--color-primary)] rounded-full animate-ping opacity-20 scale-150" />
          <div className="absolute inset-0 bg-[var(--color-accent)] rounded-full animate-ping opacity-10 scale-[2]" style={{ animationDelay: '300ms' }} />
          
          {/* 중앙 로고 아이콘 */}
          <div className="w-24 h-24 bg-white rounded-[32px] shadow-2xl flex items-center justify-center relative z-20 animate-logo-float border-2 border-[var(--color-border)]">
            <div className="text-[var(--color-accent)]">
              <Sparkles size={48} />
            </div>
          </div>
        </div>

        {/* 텍스트 애니메이션 */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tighter">
            GLUV<span className="text-[var(--color-accent)]">.</span>
          </h1>
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em] animate-pulse">
              Syncing Health Data
            </p>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div 
                  key={i} 
                  className="w-1 h-1 rounded-full bg-[var(--color-primary)] animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 카피라이트 */}
      <div className="absolute bottom-12 text-center">
        <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">
          Premium Health Assistant
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
