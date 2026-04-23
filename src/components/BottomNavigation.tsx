'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Utensils, Activity, Lightbulb, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: '홈' },
  { href: '/meals', icon: Utensils, label: '식단' },
  { href: '/glucose', icon: Activity, label: '혈당' },
  { href: '/insights', icon: Lightbulb, label: '인사이트' },
  { href: '/profile', icon: Settings, label: '설정' },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav bg-white/95 border-t border-[var(--color-border)] shadow-[0_-4px_20px_rgba(255,183,197,0.1)]">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-4 py-2 transition-all duration-300 relative group"
            >
              <div className={`p-2 rounded-2xl transition-all duration-300 ${
                isActive
                  ? 'bg-[var(--color-primary-soft)] scale-110'
                  : 'group-active:bg-[var(--color-bg-secondary)]'
              }`}>
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`transition-colors duration-300 ${
                    isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
                  }`}
                />
              </div>
              <span className={`text-[10px] font-bold transition-colors duration-300 ${
                isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
              }`}>
                {label}
              </span>
              {isActive && (
                <div className="absolute -top-1 w-1 h-1 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
