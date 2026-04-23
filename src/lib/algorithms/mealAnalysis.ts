import { Meal, GlucoseReading } from '@/types';

interface GlucoseImpact {
  deltaBG: number;
  peakValue: number;
  peakTimeMinutes: number;
  twoHourValue: number;
  baselineValue: number;
  status: 'calculating' | 'insufficient_data' | 'complete';
}

/**
 * 특정 식사 시점 전후의 혈당 데이터를 분석하여 영향을 계산합니다.
 */
export function calculateMealImpact(meal: Meal, readings: GlucoseReading[]): GlucoseImpact {
  const mealTime = meal.timestamp.getTime();
  
  // 식사 전 30분 ~ 식사 후 3시간 데이터 필터링
  const relevantReadings = readings.filter(r => {
    const rTime = r.timestamp.getTime();
    return rTime >= mealTime - 30 * 60 * 1000 && rTime <= mealTime + 180 * 60 * 1000;
  }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (relevantReadings.length < 2) {
    return { deltaBG: 0, peakValue: 0, peakTimeMinutes: 0, twoHourValue: 0, baselineValue: 0, status: 'insufficient_data' };
  }

  // 식전 기준점 (식사 시간과 가장 가까운 이전 데이터)
  const baseline = relevantReadings.find(r => r.timestamp.getTime() <= mealTime) || relevantReadings[0];
  
  // 식후 데이터
  const postReadings = relevantReadings.filter(r => r.timestamp.getTime() > mealTime);
  
  if (postReadings.length === 0) {
    return { deltaBG: 0, peakValue: 0, peakTimeMinutes: 0, twoHourValue: 0, baselineValue: 0, status: 'insufficient_data' };
  }

  // 피크 찾기
  let peak = postReadings[0];
  for (const r of postReadings) {
    if (r.value > peak.value) peak = r;
  }

  // 식후 2시간(120분)에 가장 가까운 데이터
  const twoHourTarget = mealTime + 120 * 60 * 1000;
  const twoHourReading = postReadings.reduce((prev, curr) => {
    return Math.abs(curr.timestamp.getTime() - twoHourTarget) < Math.abs(prev.timestamp.getTime() - twoHourTarget) ? curr : prev;
  });

  return {
    deltaBG: peak.value - baseline.value,
    peakValue: peak.value,
    peakTimeMinutes: Math.round((peak.timestamp.getTime() - mealTime) / (60 * 1000)),
    twoHourValue: twoHourReading.value,
    baselineValue: baseline.value,
    status: 'complete'
  };
}
