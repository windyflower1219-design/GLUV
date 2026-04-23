'use client';

import React from 'react';
import { Droplet } from 'lucide-react';

interface TabLoadingProps {
  isVisible: boolean;
}

const TabLoading: React.FC<TabLoadingProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--color-bg-primary)]/80 backdrop-blur-md animate-fade-in">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute -inset-2 bg-[var(--color-accent-pink)]/30 rounded-full blur-xl animate-pulse" />
          <div className="relative w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-white">
            <Droplet className="text-[var(--color-accent-pink)] animate-bounce-slow" size={32} fill="currentColor" />
          </div>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div 
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-pink)] animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-[10px] font-black text-[var(--color-accent-pink)] uppercase tracking-[0.2em] opacity-80">
          Preparing your data
        </p>
      </div>
    </div>
  );
};

export default TabLoading;
