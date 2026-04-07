import React from 'react';
import Link from 'next/link';
import { Bell } from './Icons';

interface PageHeaderProps {
  title: string;
  showBranding?: boolean;
  subtitle?: string;
  rightElement?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, showBranding = false, subtitle, rightElement 
}) => {
  return (
    <header className="safe-top px-6 pt-6 pb-2 sticky top-0 bg-[var(--color-bg-primary)]/90 backdrop-blur-xl z-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBranding ? (
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <h1 className="text-2xl font-black text-gray-800 tracking-tighter">GLUV</h1>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-400 leading-none">Glucose + View</span>
                  <span className="text-[7px] font-medium text-rose-300 leading-none mt-1 uppercase tracking-tighter">for YR Lee</span>
                </div>
              </div>
              {subtitle && <p className="text-xs font-bold text-gray-400 mt-1">{subtitle} 👋</p>}
            </div>
          ) : (
            <div>
              <h1 className="text-xl font-black text-gray-800">{title}</h1>
              {subtitle && <p className="text-[10px] font-bold text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {rightElement || (
            <Link href="/insights" className="relative w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-gray-50 active:scale-90 transition-all">
              <Bell size={20} className="text-gray-400" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
