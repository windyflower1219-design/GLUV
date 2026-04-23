'use client';

import React from 'react';
import { Droplet } from 'lucide-react';

interface LoadingScreenProps {
  isVisible: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isVisible }) => {
  return (
    <div 
      className={`fixed inset-0 z-[1000] flex flex-col items-center justify-between py-16 transition-all duration-700 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        background: 'linear-gradient(180deg, #FFF9F2 0%, #FFF3E6 100%)'
      }}
    >
      {/* Top Section - Brand */}
      <div className="flex flex-col items-center gap-4 mt-20 animate-fade-in">
        <div className="relative">
          <div className="absolute -inset-4 bg-[var(--color-accent-pink)]/20 rounded-full blur-2xl animate-loading-pulse" />
          <div className="relative w-20 h-20 bg-white rounded-3xl shadow-2xl flex items-center justify-center animate-logo-float border border-white">
            <Droplet className="text-[var(--color-accent-pink)]" size={40} fill="currentColor" />
          </div>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tighter text-[var(--color-text-primary)]">
          GLUV
        </h1>
        <p className="text-[var(--color-text-secondary)] font-medium">AI 혈당 & 식단 관리</p>
      </div>

      {/* Middle Section - Loading Indicator */}
      <div className="flex flex-col items-center gap-6">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div 
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent-pink)] animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Section - Ad Placeholder / Tip */}
      <div className="w-full max-w-sm px-6 mb-10 animate-slide-up">
        <div className="ad-placeholder w-full aspect-[16/9] glass-card flex flex-col items-center justify-center p-8 text-center gap-3">
          <div className="p-3 rounded-2xl bg-white/50 text-[var(--color-accent-pink)]">
            <Droplet size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--color-text-primary)] mb-1">
              더 건강한 내일을 위한 파트너
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              혈당 스파이크를 줄이는 가장 쉬운 방법,<br />GLUV와 함께 시작하세요.
            </p>
          </div>
          <div className="mt-2 px-4 py-1.5 bg-[var(--color-accent-pink)] text-white text-[10px] font-bold rounded-full shadow-lg shadow-pink-200">
            Learn More
          </div>
        </div>
        <p className="text-center mt-6 text-[10px] text-[var(--color-text-secondary)] font-medium opacity-50">
          © 2024 GLUV Healthcare. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
