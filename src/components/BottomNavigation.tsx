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
    <nav className="bottom-nav bg-[#FFFCF7]/95 border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
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
                  ? 'bg-[var(--color-accent-pink)]/10 scale-110'
                  : 'group-active:bg-gray-100'
              }`}>
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`transition-colors duration-300 ${
                    isActive ? 'text-[var(--color-accent-pink)]' : 'text-gray-300'
                  }`}
                />
              </div>
              <span className={`text-[10px] font-bold transition-colors duration-300 ${
                isActive ? 'text-[var(--color-accent-pink)]' : 'text-gray-300'
              }`}>
                {label}
              </span>
              {isActive && (
                <div className="absolute -top-1 w-1 h-1 rounded-full bg-[var(--color-accent-pink)] shadow-[0_0_8px_var(--color-accent-pink)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
