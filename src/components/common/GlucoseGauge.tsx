import React from 'react';

interface GlucoseGaugeProps {
  value: number;
  targetMin?: number;
  targetMax?: number;
  loading?: boolean;
}

const GlucoseGauge: React.FC<GlucoseGaugeProps> = ({ 
  value, targetMin = 70, targetMax = 140, loading = false 
}) => {
  if (loading) {
    return <div className="skeleton w-48 h-48 rounded-full mx-auto" />;
  }

  // 혈당 기록이 없을 경우 빈 상태 표시
  if (!value || value === 0) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-48 h-48 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-8 border-gray-50 shadow-inner" />
          <div className="absolute inset-4 rounded-full border-2 border-dashed border-gray-100" />
          <div className="relative z-10 text-center px-4">
            <span className="text-4xl block mb-2">💧</span>
            <p className="text-sm font-black text-gray-400 leading-relaxed">아직 혈당 기록이<br/>없어요!</p>
          </div>
        </div>
        <div className="px-6 py-2 rounded-2xl bg-gray-50 text-gray-400 shadow-sm border border-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          <p className="text-xs font-black">혈당을 기록해보세요</p>
        </div>
      </div>
    );
  }

  const isHigh = value > targetMax;
  const isLow = value < targetMin;
  
  const config = isHigh 
    ? { label: '조금 높아요!', color: 'text-[var(--color-accent)]', bg: 'bg-[var(--color-primary-soft)]', icon: '🍰' }
    : isLow 
    ? { label: '낮은 편이에요!', color: 'text-[var(--color-warning)]', bg: 'bg-[#FFF9F0]', icon: '🍎' }
    : { label: '참 잘하고 있어요!', color: 'text-[var(--color-success)]', bg: 'bg-[#F0FFF6]', icon: '✨' };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* 장식용 배경 원 */}
        <div className="absolute inset-0 rounded-full border-8 border-gray-50 shadow-inner" />
        <div className="absolute inset-4 rounded-full border-2 border-dashed border-gray-100 animate-spin-slow" />
        
        {/* 수치 표시 */}
        <div className="relative z-10 text-center">
          <span className="text-4xl block mb-1">{config.icon}</span>
          <p className="text-5xl font-black text-[var(--color-text-primary)] tracking-tighter">{value}</p>
          <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">mg / dL</p>
        </div>

        {/* 게이지 바 (SVG) - 핑크의 보색인 민트를 적절히 섞어 사용 */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={isHigh ? 'var(--color-accent)' : isLow ? 'var(--color-warning)' : 'var(--color-success)'}
            strokeWidth="8"
            strokeDasharray={`${Math.min(276, (value / 300) * 276)} 276`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
      </div>
      
      <div className={`mt-6 px-6 py-2 rounded-2xl ${config.bg} ${config.color} shadow-sm border border-white flex items-center gap-2 animate-fade-in`}>
        <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        <p className="text-xs font-black">{config.label}</p>
      </div>
    </div>
  );
};

export default GlucoseGauge;
