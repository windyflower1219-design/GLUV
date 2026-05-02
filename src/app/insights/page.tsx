'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Zap, ChevronRight, CheckCircle, Bell, TrendingUp, Award, Sparkles, Heart, Star, Info, Loader2 } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import type { ActionableInsight } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlucoseData } from '@/lib/hooks/useGlucoseData';
import { getMeals } from '@/lib/firebase/firestore';
import { queryFor, type NutrientKey } from '@/lib/admin/keywords';

const TYPE_FILTERS = [
  { key: 'all', label: '전체보기' },
  { key: 'spike_alert', label: '알림' },
  { key: 'prediction', label: '예측' },
  { key: 'recommendation', label: '추천' },
  { key: 'achievement', label: '칭찬' },
];

const TYPE_COLORS: Record<ActionableInsight['type'], { bg: string; iconBg: string; text: string; badge: string }> = {
  spike_alert: { bg: 'bg-rose-50', iconBg: 'bg-rose-100', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-600' },
  prediction: { bg: 'bg-indigo-50', iconBg: 'bg-indigo-100', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-600' },
  recommendation: { bg: 'bg-amber-50', iconBg: 'bg-amber-100', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  achievement: { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-600' },
  warning: { bg: 'bg-orange-50', iconBg: 'bg-orange-100', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-600' },
};

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor(diffMs / 60000);
  if (diffH >= 24) return `${Math.floor(diffH / 24)}일 전`;
  if (diffH >= 1) return `${diffH}시간 전`;
  return `${diffM}분 전`;
}

import { useHealthData } from '@/context/HealthDataContext';

export default function InsightsPage() {
  const { user } = useAuth();
  const userId = user?.uid || 'guest';
  const { averageGlucose } = useGlucoseData();
  const { meals: recentMealsData, glucoseReadings } = useHealthData();
  const [insights, setInsights] = useState<ActionableInsight[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // 데이터 기반 인사이트 분석 엔진 (AI 없이 동작 / 룰 기반)
  // - 영양 결핍 deficiency에는 NutrientKey가 부여되어 admin이 관리하는 검색어로 연결됨
  const dataDrivenInsights = React.useMemo(() => {
    if (!recentMealsData.length || !glucoseReadings.length) return null;

    // ── 0. 시간 윈도 ─────────────────────────────────────────────
    const ANALYSIS_DAYS = 7;
    const sevenDaysAgo = Date.now() - ANALYSIS_DAYS * 24 * 60 * 60 * 1000;
    const recentWeekMeals = recentMealsData.filter(m => m.timestamp.getTime() >= sevenDaysAgo);
    const recentWeekReadings = glucoseReadings.filter(r => r.timestamp.getTime() >= sevenDaysAgo);

    // ── 1. 음식별 혈당 스파이크 상관 ─────────────────────────────
    const foodCorrelations: Record<string, { spikes: number[]; counts: number }> = {};
    recentMealsData.forEach(meal => {
      const mealTime = meal.timestamp.getTime();
      const postMealReadings = glucoseReadings.filter(r => {
        const diff = r.timestamp.getTime() - mealTime;
        return diff > 0 && diff <= 2 * 60 * 60 * 1000;
      });
      if (postMealReadings.length === 0) return;
      const preMealReading = glucoseReadings
        .filter(r => r.timestamp.getTime() <= mealTime)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      const baseLine = preMealReading ? preMealReading.value : 100;
      const maxReading = Math.max(...postMealReadings.map(r => r.value));
      const spike = maxReading - baseLine;
      meal.parsedFoods.forEach(food => {
        if (!food.name) return;
        if (!foodCorrelations[food.name]) foodCorrelations[food.name] = { spikes: [], counts: 0 };
        foodCorrelations[food.name].spikes.push(spike);
        foodCorrelations[food.name].counts += 1;
      });
    });
    const foodInsights = Object.entries(foodCorrelations)
      .map(([name, data]) => ({
        name,
        avgSpike: data.spikes.reduce((a, b) => a + b, 0) / data.spikes.length,
        count: data.counts,
      }))
      .filter(f => f.count >= 1);
    const worstFoods = [...foodInsights].sort((a, b) => b.avgSpike - a.avgSpike).slice(0, 3);
    const bestFoods = [...foodInsights].sort((a, b) => a.avgSpike - b.avgSpike).slice(0, 3);

    // ── 2. 영양소 합계 / 일평균 ──────────────────────────────────
    const totals = { carbs: 0, protein: 0, fat: 0, calories: 0, sodium: 0 };
    recentWeekMeals.forEach(m => {
      m.parsedFoods.forEach((f: any) => {
        totals.carbs    += Number(f.carbs    ?? 0) || 0;
        totals.protein  += Number(f.protein  ?? 0) || 0;
        totals.fat      += Number(f.fat      ?? 0) || 0;
        totals.calories += Number(f.calories ?? 0) || 0;
        totals.sodium   += Number(f.sodium   ?? 0) || 0;
      });
    });
    const days = Math.max(1, ANALYSIS_DAYS);
    const avg = {
      protein: totals.protein / days,
      carbs: totals.carbs / days,
      fat: totals.fat / days,
      calories: totals.calories / days,
      sodium: totals.sodium / days,
    };
    const carbCalories = avg.carbs * 4;
    const carbRatio = avg.calories > 0 ? carbCalories / avg.calories : 0;

    // ── 3. 혈당 통계 (변동성 / 시간대별) ─────────────────────────
    const values = recentWeekReadings.map(r => r.value);
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const variance = values.length
      ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
      : 0;
    const stddev = Math.sqrt(variance);
    const cv = mean > 0 ? (stddev / mean) * 100 : 0; // 변동계수(%)
    const inRange = values.filter(v => v >= 70 && v <= 140).length;
    const tir = values.length > 0 ? (inRange / values.length) * 100 : 0; // Time-In-Range
    const lows = values.filter(v => v < 70).length;
    const highs = values.filter(v => v > 180).length;

    // 시간대별 평균
    const morning: number[] = [];
    const afternoon: number[] = [];
    const evening: number[] = [];
    recentWeekReadings.forEach(r => {
      const h = r.timestamp.getHours();
      if (h >= 5 && h < 12) morning.push(r.value);
      else if (h >= 12 && h < 18) afternoon.push(r.value);
      else evening.push(r.value);
    });
    const avgOf = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const morningAvg = avgOf(morning);
    const afternoonAvg = avgOf(afternoon);
    const eveningAvg = avgOf(evening);

    // 야식 빈도 (22시 이후)
    const lateMeals = recentWeekMeals.filter(m => {
      const h = m.timestamp.getHours();
      return h >= 22 || h < 4;
    }).length;

    // 마지막 측정 후 경과 시간
    const lastReading = recentWeekReadings[recentWeekReadings.length - 1];
    const hoursSinceLast = lastReading
      ? (Date.now() - lastReading.timestamp.getTime()) / 3_600_000
      : Infinity;

    // ── 4. 영양 결핍 룰 (NutrientKey 기반 — admin 키워드와 연결) ──
    type Deficiency = {
      key: NutrientKey;
      name: string;
      current: number;
      target: number;
      unit: string;
      reason: string;
      query: string; // admin이 관리하는 검색어 (즉시 반영)
    };
    const deficiencies: Deficiency[] = [];

    // 4-1) 단백질
    const TARGET_PROTEIN = 60;
    if (avg.protein < TARGET_PROTEIN) {
      deficiencies.push({
        key: 'protein',
        name: '단백질',
        current: Math.round(avg.protein),
        target: TARGET_PROTEIN,
        unit: 'g',
        reason: `하루 평균 ${Math.round(TARGET_PROTEIN - avg.protein)}g이 부족해요. 근육 유지와 식후 혈당 완충에 필수적입니다.`,
        query: queryFor('protein'),
      });
    }

    // 4-2) 식이섬유 (채소·샐러드·쌈 키워드 매칭 횟수)
    const veggieCount = recentWeekMeals.filter(m =>
      m.rawVoiceInput?.includes('채소') ||
      m.rawVoiceInput?.includes('샐러드') ||
      m.rawVoiceInput?.includes('쌈') ||
      m.rawVoiceInput?.includes('나물') ||
      m.rawVoiceInput?.includes('브로콜리')
    ).length;
    if (veggieCount < 5) {
      deficiencies.push({
        key: 'fiber',
        name: '식이섬유',
        current: veggieCount,
        target: 7,
        unit: '회',
        reason: `채소 섭취가 주 ${5 - veggieCount}회 더 필요해요. 식이섬유는 당 흡수를 늦춰 식후 스파이크를 줄여줍니다.`,
        query: queryFor('fiber'),
      });
    }

    // 4-3) 평균 혈당 ≥ 130 또는 식후 스파이크 잦으면 → 저당 간식 추천
    const avgPostSpike = foodInsights.length
      ? foodInsights.reduce((s, f) => s + f.avgSpike, 0) / foodInsights.length
      : 0;
    if (mean >= 130 || avgPostSpike >= 50) {
      deficiencies.push({
        key: 'lowSugar',
        name: '저당 간식',
        current: Math.round(mean || 0),
        target: 110,
        unit: 'mg/dL',
        reason: `평균 혈당 ${Math.round(mean)} 또는 식후 평균 +${Math.round(avgPostSpike)}로 스파이크 부담이 있어요. 무가당 간식으로 단순당을 대체해보세요.`,
        query: queryFor('lowSugar'),
      });
    }

    // 4-4) 탄수 비중이 60% 초과 → 복합탄수 추천
    if (carbRatio > 0.60) {
      deficiencies.push({
        key: 'complexCarb',
        name: '복합탄수',
        current: Math.round(carbRatio * 100),
        target: 55,
        unit: '%',
        reason: `총 칼로리의 ${Math.round(carbRatio * 100)}%가 탄수예요. 정제 탄수를 통곡물(귀리·현미)로 바꾸면 혈당이 천천히 오릅니다.`,
        query: queryFor('complexCarb'),
      });
    }

    // 4-5) 야식 패턴 (주 3회 이상 22시 이후 식사)
    if (lateMeals >= 3) {
      deficiencies.push({
        key: 'lateNightSnack',
        name: '야식 대용',
        current: lateMeals,
        target: 1,
        unit: '회/주',
        reason: `최근 7일간 야식이 ${lateMeals}회 있었어요. 잘 때 혈당이 안 떨어져 다음 날 공복 혈당을 올립니다. 저당 단백 위주로 대체해보세요.`,
        query: queryFor('lateNightSnack'),
      });
    }

    // 4-6) 나트륨 일평균 2000mg 초과 → 저염
    if (avg.sodium > 2000) {
      deficiencies.push({
        key: 'lowSodium',
        name: '저염',
        current: Math.round(avg.sodium),
        target: 2000,
        unit: 'mg',
        reason: `일평균 나트륨 ${Math.round(avg.sodium)}mg로 권장량 초과예요. 혈압 부담이 누적될 수 있어요.`,
        query: queryFor('lowSodium'),
      });
    }

    // ── 5. 운동 추천 ─────────────────────────────────────────────
    let exerciseRec = {
      type: '가벼운 산책',
      duration: '20분',
      reason: '식후 가벼운 움직임이 혈당 스파이크를 효과적으로 막아줍니다.',
      ytQuery: '식후 20분 걷기 효과',
    };
    if (averageGlucose > 140 || mean > 140) {
      exerciseRec = {
        type: '빠르게 걷기',
        duration: '40분',
        reason: '평균 혈당이 높아요. 에너지 소비량을 늘려 혈당을 낮춰야 합니다.',
        ytQuery: '당뇨 혈당 낮추는 운동',
      };
    } else if (cv > 36) {
      exerciseRec = {
        type: '인터벌 걷기',
        duration: '30분',
        reason: '혈당 변동이 커요. 식후 인터벌 걷기로 변동성을 줄여보세요.',
        ytQuery: '인터벌 걷기 혈당 안정',
      };
    } else if (eveningAvg > 130 && eveningAvg > morningAvg + 15) {
      exerciseRec = {
        type: '저녁 식후 산책',
        duration: '25분',
        reason: '저녁 시간대 혈당이 특히 높네요. 저녁 식사 후 산책 루틴이 효과적입니다.',
        ytQuery: '저녁 식후 걷기 혈당',
      };
    }

    // ── 6. 보조 인사이트 (텍스트 카드) ────────────────────────────
    const extraInsights: Array<{ id: string; type: ActionableInsight['type']; title: string; message: string; emoji: string }> = [];

    // TIR
    if (values.length >= 5) {
      if (tir < 50) {
        extraInsights.push({
          id: 'tir_low',
          type: 'warning',
          title: '⚠️ 목표 범위 비율이 낮아요',
          message: `최근 일주일 70~140 범위 내 비율이 ${Math.round(tir)}%로 낮습니다. 식사 패턴 점검이 필요해요.`,
          emoji: '⚠️',
        });
      } else if (tir >= 80) {
        extraInsights.push({
          id: 'tir_high',
          type: 'achievement',
          title: '🌟 목표 범위 유지율이 훌륭해요',
          message: `목표 혈당 범위 비율 ${Math.round(tir)}%! 지금 흐름을 그대로 유지해보세요.`,
          emoji: '🌟',
        });
      }
    }

    // 변동성
    if (cv > 36 && values.length >= 5) {
      extraInsights.push({
        id: 'cv_high',
        type: 'warning',
        title: '📉 혈당 변동이 큰 편이에요',
        message: `변동계수 ${cv.toFixed(1)}% — 안정 권고치(36% 이하)를 넘었습니다. 식사 간격과 단순당 줄이기에 신경 써보세요.`,
        emoji: '📉',
      });
    }

    // 저혈당
    if (lows >= 2) {
      extraInsights.push({
        id: 'low_freq',
        type: 'warning',
        title: '⚠️ 저혈당이 자주 보였어요',
        message: `최근 7일간 70 미만 측정이 ${lows}회 있었어요. 공복 시간이 너무 길지 않게 조정해보세요.`,
        emoji: '⚠️',
      });
    }

    // 고혈당
    if (highs >= 3) {
      extraInsights.push({
        id: 'high_freq',
        type: 'spike_alert',
        title: '🔥 180 초과가 잦았어요',
        message: `최근 7일간 ${highs}회 180을 넘겼어요. 트리거 음식과 시점을 파악하기 위해 식후 측정을 늘려보세요.`,
        emoji: '🔥',
      });
    }

    // 시간대별
    if (morningAvg > 0 && afternoonAvg > 0 && eveningAvg > 0) {
      const stamps = [
        { name: '아침', v: morningAvg },
        { name: '오후', v: afternoonAvg },
        { name: '저녁', v: eveningAvg },
      ].sort((a, b) => b.v - a.v);
      if (stamps[0].v - stamps[2].v >= 20) {
        extraInsights.push({
          id: 'time_pattern',
          type: 'prediction',
          title: `🕒 ${stamps[0].name} 시간대 혈당이 가장 높아요`,
          message: `${stamps[0].name} 평균 ${Math.round(stamps[0].v)} vs ${stamps[2].name} 평균 ${Math.round(stamps[2].v)}. ${stamps[0].name} 식사 구성을 우선 점검해보세요.`,
          emoji: '🕒',
        });
      }
    }

    // 측정 주기
    if (hoursSinceLast > 8 && hoursSinceLast !== Infinity) {
      extraInsights.push({
        id: 'measure_gap',
        type: 'recommendation',
        title: '⏰ 측정 시간 간격이 길어요',
        message: `마지막 측정 후 ${Math.round(hoursSinceLast)}시간이 지났어요. 식전·식후 측정 루틴을 챙겨보세요.`,
        emoji: '⏰',
      });
    }

    // 칼로리 추세
    if (avg.calories > 2400) {
      extraInsights.push({
        id: 'cal_high',
        type: 'recommendation',
        title: '🍽 일평균 칼로리가 다소 높아요',
        message: `일평균 ${Math.round(avg.calories)} kcal. 한 끼당 200~300kcal 정도 줄이는 것만으로도 혈당과 체중 관리에 도움이 됩니다.`,
        emoji: '🍽',
      });
    } else if (avg.calories > 0 && avg.calories < 1400) {
      extraInsights.push({
        id: 'cal_low',
        type: 'warning',
        title: '⚠️ 식사량이 부족해 보여요',
        message: `일평균 ${Math.round(avg.calories)} kcal로 낮습니다. 너무 적게 먹으면 다음 끼니 폭식과 혈당 변동의 원인이 됩니다.`,
        emoji: '⚠️',
      });
    }

    return {
      worstFoods,
      bestFoods,
      deficiencies,
      exerciseRec,
      stats: { mean, stddev, cv, tir, lows, highs, morningAvg, afternoonAvg, eveningAvg, lateMeals },
      extraInsights,
    };
  }, [recentMealsData, glucoseReadings, averageGlucose]);

  // AI 호출 없이, 로컬 데이터 분석 결과(dataDrivenInsights)로 인사이트를 즉시 생성
  const fetchAIInsights = useCallback(async () => {
    setIsGenerating(true);
    try {
      if (!dataDrivenInsights) {
        setInsights([{
          id: 'fallback_water',
          type: 'recommendation',
          title: '💧 물 충분히 마시기',
          message: '혈당 관리에 수분 섭취는 필수입니다. 하루 1.5L~2L 정도 충분히 마셔보세요.',
          emoji: '💧',
          createdAt: new Date(),
          isRead: false,
        }]);
        return;
      }
      const { worstFoods, bestFoods, deficiencies, exerciseRec, extraInsights } = dataDrivenInsights;
      const out: ActionableInsight[] = [];

      // 평균 혈당 기준 메인 메시지
      if (averageGlucose > 0) {
        if (averageGlucose >= 140) {
          out.push({
            id: 'avg_high',
            type: 'warning',
            title: '⚠️ 평균 혈당이 높아요',
            message: `최근 평균 혈당이 ${Math.round(averageGlucose)} mg/dL 입니다. 식후 가벼운 산책과 단순당 줄이기를 시작해보세요.`,
            emoji: '⚠️',
            createdAt: new Date(),
            isRead: false,
          });
        } else if (averageGlucose >= 100) {
          out.push({
            id: 'avg_ok',
            type: 'recommendation',
            title: '🟢 평균 혈당 정상 범위',
            message: `최근 평균 혈당 ${Math.round(averageGlucose)} mg/dL 입니다. 지금 흐름을 유지해보세요.`,
            emoji: '🟢',
            createdAt: new Date(),
            isRead: false,
          });
        } else {
          out.push({
            id: 'avg_low',
            type: 'achievement',
            title: '🌟 안정적인 혈당',
            message: `평균 ${Math.round(averageGlucose)} mg/dL — 매우 안정적입니다. 꾸준함이 가장 큰 약입니다.`,
            emoji: '🌟',
            createdAt: new Date(),
            isRead: false,
          });
        }
      }

      // 가장 영향이 큰 음식
      if (worstFoods.length > 0) {
        const top = worstFoods[0];
        out.push({
          id: 'worst_food',
          type: 'spike_alert',
          title: `📈 ${top.name} 섭취 후 혈당이 많이 올라요`,
          message: `평균 +${Math.round(top.avgSpike)} mg/dL 상승했어요. 양을 줄이거나 채소·단백질과 함께 드셔보세요.`,
          emoji: '📈',
          createdAt: new Date(),
          isRead: false,
        });
      }

      // 가장 안정적인 음식
      if (bestFoods.length > 0 && bestFoods[0].avgSpike < 30) {
        const best = bestFoods[0];
        out.push({
          id: 'best_food',
          type: 'achievement',
          title: `💚 ${best.name}은 잘 맞아요`,
          message: `평균 +${Math.round(best.avgSpike)} mg/dL 만 오르는 안정적인 메뉴입니다. 자주 활용해보세요.`,
          emoji: '💚',
          createdAt: new Date(),
          isRead: false,
        });
      }

      // 영양 결핍 (NutrientKey별 이모지 매핑)
      const NUTRIENT_EMOJI: Record<string, string> = {
        protein: '🍗', fiber: '🥦', lowSugar: '🍅', complexCarb: '🌾',
        lateNightSnack: '🌙', lowSodium: '🧂',
      };
      deficiencies.forEach((d, i) => {
        const e = NUTRIENT_EMOJI[d.key] || '🥦';
        out.push({
          id: `def_${d.key}_${i}`,
          type: 'recommendation',
          title: `${e} ${d.name} 보충이 필요해요`,
          message: d.reason,
          emoji: e,
          createdAt: new Date(),
          isRead: false,
        });
      });

      // 보조 인사이트 (TIR, 변동성, 저혈당, 시간대 패턴 등)
      extraInsights.forEach(ex => {
        out.push({ ...ex, createdAt: new Date(), isRead: false });
      });

      // 운동 추천
      out.push({
        id: 'exercise',
        type: 'recommendation',
        title: `🚶 ${exerciseRec.type} ${exerciseRec.duration}`,
        message: exerciseRec.reason,
        emoji: '🚶',
        createdAt: new Date(),
        isRead: false,
      });

      // 데이터가 거의 없을 때 기본 안내
      if (out.length === 0) {
        out.push({
          id: 'fallback_water',
          type: 'recommendation',
          title: '💧 물 충분히 마시기',
          message: '혈당 관리에 수분 섭취는 필수입니다. 하루 1.5L~2L 정도 충분히 마셔보세요.',
          emoji: '💧',
          createdAt: new Date(),
          isRead: false,
        });
      }

      setInsights(out);
      if (out.length > 0) setExpandedId(out[0].id);
    } finally {
      setIsGenerating(false);
    }
  }, [dataDrivenInsights, averageGlucose]);

  // 처음 들어왔을 때 인사이트가 비어있으면 생성
  useEffect(() => {
    if (insights.length === 0) {
      fetchAIInsights();
    }
  }, [insights.length, fetchAIInsights]);

  const unreadCount = insights.filter((i) => !i.isRead).length;

  const filtered = activeFilter === 'all'
    ? insights
    : insights.filter(i => i.type === activeFilter);

  const markAsRead = (id: string) => {
    setInsights(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] page-content">
      <header className="safe-top px-6 pt-8 pb-4 sticky top-0 bg-[var(--color-bg-primary)]/90 backdrop-blur z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tight">GLUV 핑크 리포트 🎀</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">데이터 기반 맞춤 리포트</p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-5 space-y-6 pt-2 pb-10">
        {/* 1. AI 생성 인사이트 섹션 (누락되었던 부분 복구) */}
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 rounded-[40px] border border-dashed border-gray-100">
            <Loader2 size={32} className="text-[var(--color-accent)] animate-spin mb-4" />
            <p className="text-xs font-black text-gray-400">건강 데이터를 정리 중이에요...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map((insight) => (
              <div 
                key={insight.id}
                className={`bg-white rounded-[32px] p-6 shadow-sm border border-gray-50 relative overflow-hidden transition-all ${expandedId === insight.id ? 'ring-2 ring-[var(--color-primary-soft)]' : ''}`}
                onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${TYPE_COLORS[insight.type].bg}`}>
                    {insight.emoji || '✨'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${TYPE_COLORS[insight.type].badge}`}>
                        {TYPE_FILTERS.find(f => f.key === insight.type)?.label || '분석'}
                      </span>
                      <p className="text-[9px] font-bold text-gray-300">{formatRelativeTime(insight.createdAt)}</p>
                    </div>
                    <h3 className="text-sm font-black text-[var(--color-text-primary)]">{insight.title}</h3>
                    <p className={`text-[11px] font-bold text-[var(--color-text-secondary)] leading-relaxed mt-2 ${expandedId === insight.id ? '' : 'line-clamp-1'}`}>
                      {insight.message}
                    </p>
                  </div>
                  <ChevronRight size={16} className={`text-gray-300 mt-1 transition-transform ${expandedId === insight.id ? 'rotate-90' : ''}`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. 데이터 기반 심층 분석 섹션 */}
        {dataDrivenInsights ? (
          <div className="space-y-6">
            {/* 혈당 민감 음식 분석 */}
            <div className="bg-white rounded-[40px] p-7 shadow-sm border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-9 h-9 rounded-2xl bg-[var(--color-primary-soft)] flex items-center justify-center">
                  <TrendingUp size={18} className="text-[var(--color-accent)]" />
                </div>
                <h2 className="text-base font-black text-[var(--color-text-primary)]">내 혈당에 민감한 음식들</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 px-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger)]" />
                    <p className="text-[11px] font-black text-[var(--color-text-secondary)] uppercase tracking-wider">주의할까요?</p>
                  </div>
                  {dataDrivenInsights.worstFoods.length > 0 ? dataDrivenInsights.worstFoods.map(f => (
                    <div key={f.name} className="bg-[#FFF5F6] p-4 rounded-3xl border border-[#FFE8EB]">
                      <p className="text-xs font-black text-[var(--color-text-primary)] truncate">{f.name}</p>
                      <p className="text-[10px] font-bold text-[var(--color-accent)] mt-1.5">평균 +{Math.round(f.avgSpike)} mg/dL</p>
                    </div>
                  )) : <p className="text-[10px] text-gray-300 px-1">기록이 부족해요</p>}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 px-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                    <p className="text-[11px] font-black text-[var(--color-text-secondary)] uppercase tracking-wider">부담 없어요</p>
                  </div>
                  {dataDrivenInsights.bestFoods.length > 0 ? dataDrivenInsights.bestFoods.map(f => (
                    <div key={f.name} className="bg-[#F6FFF9] p-4 rounded-3xl border border-[#E8FFEF]">
                      <p className="text-xs font-black text-[var(--color-text-primary)] truncate">{f.name}</p>
                      <p className="text-[10px] font-bold text-emerald-500 mt-1.5">안전함 ✨</p>
                    </div>
                  )) : <p className="text-[10px] text-gray-300 px-1">기록이 부족해요</p>}
                </div>
              </div>
            </div>

            {/* 영양학 분석 */}
            <div className="bg-white rounded-[40px] p-7 shadow-sm border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-9 h-9 rounded-2xl bg-[var(--color-primary-soft)] flex items-center justify-center">
                  <Heart size={18} className="text-[var(--color-accent)]" />
                </div>
                <h2 className="text-base font-black text-[var(--color-text-primary)]">부족한 영양소 보충하기</h2>
              </div>

              <div className="space-y-5">
                {dataDrivenInsights.deficiencies.length > 0 ? dataDrivenInsights.deficiencies.map(d => {
                  const NUTRIENT_EMOJI: Record<string, string> = {
                    protein: '🍗', fiber: '🥦', lowSugar: '🍅', complexCarb: '🌾',
                    lateNightSnack: '🌙', lowSodium: '🧂',
                  };
                  const emoji = NUTRIENT_EMOJI[d.key] || '🥦';
                  return (
                  <div key={d.key} className="bg-[var(--color-bg-primary)] rounded-[32px] p-6 border border-[var(--color-border)]">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <p className="text-base font-black text-[var(--color-text-primary)]">{d.name}</p>
                           <span className="text-[10px] font-black bg-[var(--color-accent)] text-white px-2 py-0.5 rounded-full">CHECK!</span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-1">
                          <p className="text-sm font-black text-[var(--color-accent)]">{d.current}{d.unit}</p>
                          <p className="text-[10px] font-bold text-[var(--color-text-muted)]">/ 목표 {d.target}{d.unit}</p>
                        </div>
                      </div>
                      <span className="text-3xl">{emoji}</span>
                    </div>

                    <div className="bg-white/60 p-4 rounded-2xl mb-5">
                       <p className="text-[11px] font-bold text-[var(--color-text-secondary)] leading-relaxed">{d.reason}</p>
                    </div>

                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] mb-2 px-1">검색어: <span className="text-[var(--color-accent)]">{d.query}</span></p>
                    <div className="flex gap-2.5">
                      <a href={`https://www.coupang.com/np/search?q=${encodeURIComponent(d.query)}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white border border-gray-100 py-3 rounded-2xl text-[11px] font-black text-center shadow-sm">쿠팡</a>
                      <a href={`https://www.kurly.com/search?keyword=${encodeURIComponent(d.query)}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white border border-gray-100 py-3 rounded-2xl text-[11px] font-black text-center shadow-sm">컬리</a>
                      <a href={`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(d.query)}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white border border-gray-100 py-3 rounded-2xl text-[11px] font-black text-center shadow-sm">네이버</a>
                    </div>
                  </div>
                  );
                }) : (
                  <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 text-center">
                    <p className="text-xs font-black text-emerald-600">영양 밸런스가 아주 훌륭해요! 🌸</p>
                  </div>
                )}
              </div>
            </div>

            {/* 운동 가이드 */}
            <div className="bg-[#5F4B4B] rounded-[40px] p-8 shadow-xl shadow-[#FFB7C5]/20 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Zap size={100} strokeWidth={3} />
              </div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Zap size={18} className="text-[var(--color-primary)]" />
                </div>
                <h2 className="text-sm font-black text-white/70 uppercase tracking-widest">최신 추천 운동</h2>
              </div>
              <h3 className="text-2xl font-black mb-3">{dataDrivenInsights.exerciseRec.type} {dataDrivenInsights.exerciseRec.duration}</h3>
              <p className="text-[11px] font-bold text-white/50 leading-relaxed max-w-[85%] mb-8">{dataDrivenInsights.exerciseRec.reason}</p>
              <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(dataDrivenInsights.exerciseRec.ytQuery)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white px-7 py-3.5 rounded-2xl text-xs font-black shadow-lg">
                <Sparkles size={14} /> 유튜브 가이드
              </a>
            </div>
          </div>
        ) : !isGenerating && (
          <div className="py-20 text-center bg-white rounded-[40px] border border-gray-100">
            <p className="text-xs font-bold text-gray-400">분석을 위한 데이터가 조금 더 필요해요! 📊</p>
          </div>
        )}

        {/* 3. 하단으로 이동한 AI 건강 지침 상태 바 (빨간 박스) */}
        <div className="bg-white/80 rounded-3xl p-4 border border-[var(--color-border)] flex items-center justify-between shadow-sm mt-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center">
              <Sparkles size={14} className="text-[var(--color-accent)]" />
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--color-text-primary)]">건강 지침 동기화 완료</p>
              <p className="text-[9px] font-bold text-[var(--color-text-muted)]">최종 업데이트: 2026. 4. 24. (v2.4)</p>
            </div>
          </div>
          <div className="px-3 py-1 bg-[var(--color-bg-primary)] rounded-full border border-[var(--color-border)]">
             <p className="text-[9px] font-black text-[var(--color-accent)]">최신상태</p>
          </div>
        </div>

        {/* 4. 간소화된 분석 근거 문구 (파란 박스) */}
        <div className="pt-4 pb-12 text-center">
           <p className="text-[10px] font-black text-[var(--color-text-muted)] tracking-tight">
             관리자 검증 규칙 기반 맞춤형 로컬 분석
           </p>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
