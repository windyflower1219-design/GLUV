import React from 'react';
import { ChevronRight } from './Icons';

interface StatCardProps {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  variant?: 'detail' | 'center';
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ 
  label, value, unit, icon, color, bg, variant = 'detail', onClick 
}) => {
  if (variant === 'center') {
    return (
      <div 
        onClick={onClick}
        className={`bg-white rounded-3xl p-4 text-center shadow-sm border border-gray-50 hover:border-rose-100 transition-colors cursor-pointer group`}
      >
        <div className={`w-8 h-8 rounded-xl ${bg} ${color} flex items-center justify-center mx-auto mb-2 shadow-inner border border-white group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <p className={`text-2xl font-black ${color}`}>{value}</p>
        <p className="text-[10px] font-bold text-gray-400 mt-0.5">{label}</p>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-[32px] p-5 flex-1 shadow-sm border border-gray-50 hover:border-rose-100 transition-all group cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-2xl ${bg} ${color} flex items-center justify-center shadow-inner border border-white group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center">
          <ChevronRight size={12} className="text-gray-300" />
        </div>
      </div>
      <div className="space-y-1">
        <p className={`text-2xl font-black ${color}`}>{value}</p>
        <div className="flex items-baseline gap-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
          <span className="text-[9px] font-medium text-gray-300">{unit}</span>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
