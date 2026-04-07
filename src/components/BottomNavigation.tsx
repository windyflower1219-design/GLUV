'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Utensils, Activity, Lightbulb } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: '홈' },
  { href: '/meals', icon: Utensils, label: '식단' },
  { href: '/glucose', icon: Activity, label: '혈당' },
  { href: '/insights', icon: Lightbulb, label: '인사이트' },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-5 py-2 transition-all duration-200 group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-blue-500/20'
                  : 'group-hover:bg-white/5'
              }`}>
                <Icon
                  size={22}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
              </div>
              <span className={`text-[10px] font-medium transition-colors duration-200 ${
                isActive ? 'text-blue-400' : 'text-slate-600'
              }`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
