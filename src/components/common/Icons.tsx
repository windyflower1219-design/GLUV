import React from 'react';
import { 
  Mic as LucideMic, 
  Sparkles as LucideSparkles,
  Search, Bell, Plus, ChevronRight, ChevronDown, Trash2,
  Calendar, Activity, Target, Heart, Flame, Utensils,
  Moon, Sun, TrendingUp, TrendingDown, Minus, Camera, Filter, Award, Zap, Coffee, Loader2
} from 'lucide-react';

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

// ==============================
// Custom SVGs (Re-implemented for richer UI)
// ==============================

export const MicIcon = ({ size = 24, className = '', strokeWidth = 2.5 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

export const SparklesIcon = ({ size = 24, className = '', strokeWidth = 3 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" /><path d="M3 5h4" /><path d="M19 17v4" /><path d="M17 19h4" />
  </svg>
);

// Re-export Lucide Icons for consistency
export { 
  Search, Bell, Plus, ChevronRight, ChevronDown, Trash2,
  Calendar, Activity, Target, Heart, Flame, Utensils,
  Moon, Sun, TrendingUp, TrendingDown, Minus, Camera, Filter, Award, Zap, Coffee, Loader2
};
