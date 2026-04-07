// 혈당 분석 핵심 알고리즘
// Round 2: Glucotype 분석 + 스파이크 역추적 + 예측 모델

import type {
  GlucoseReading,
  Meal,
  FoodItem,
  GlucoseCorrelation,
  GlucotypeScore,
  SpikeRootCause,
  GlucosePrediction,
  ActionableInsight,
} from '@/types';

// ======================================================
// 1. 식사-혈당 상관관계 매칭
// ======================================================
export function matchMealToGlucose(
  mealId: string,
  mealTimestamp: Date,
  readings: GlucoseReading[],
  baselineGlucose: number = 100
): GlucoseCorrelation {
  const mealTime = mealTimestamp.getTime();

  const find = (minOffset: number, maxOffset: number) => {
    const matching = readings.filter(r => {
      const diff = (r.timestamp.getTime() - mealTime) / 60000;
      return diff >= minOffset && diff <= maxOffset;
    });
    if (matching.length === 0) return null;
    return Math.max(...matching.map(r => r.value));
  };

  const spike30m = find(20, 45);
  const spike1h = find(50, 75);
  const spike2h = find(100, 130);

  const maxSpike = Math.max(
    spike30m ?? baselineGlucose,
    spike1h ?? baselineGlucose,
    spike2h ?? baselineGlucose
  ) - baselineGlucose;

  const glucotypeScore = classifyGlucotype(maxSpike);
  const returnToBaseline = spike2h !== null && Math.abs(spike2h - baselineGlucose) <= 20;

  return {
    mealId,
    baselineGlucose,
    spike30m: spike30m ? spike30m - baselineGlucose : null,
    spike1h: spike1h ? spike1h - baselineGlucose : null,
    spike2h: spike2h ? spike2h - baselineGlucose : null,
    maxSpike,
    returnToBaseline,
    glucotypeScore,
  };
}

// ======================================================
// 2. Glucotype 분류 (탄수화물 대비 혈당 상승폭)
// ======================================================
export function classifyGlucotype(maxSpikeAmount: number): GlucotypeScore {
  if (maxSpikeAmount <= 30) return 'green';   // 30mg/dL 이하: 안전
  if (maxSpikeAmount <= 60) return 'yellow';  // 31-60mg/dL: 주의
  return 'red';                               // 61mg/dL 이상: 위험
}

export function classifyGlucotypeByCarbs(
  foods: FoodItem[],
  maxSpike: number
): GlucotypeScore {
  const totalCarbs = foods.reduce((sum, f) => sum + f.carbs * f.quantity, 0);
  if (totalCarbs === 0) return 'green';
  const carbToSpikeRatio = maxSpike / totalCarbs;

  // 탄수화물 1g당 혈당 상승폭
  if (carbToSpikeRatio <= 0.5) return 'green';
  if (carbToSpikeRatio <= 1.0) return 'yellow';
  return 'red';
}

// ======================================================
// 3. 혈당 스파이크 원인 역추적
// ======================================================
export function traceGlucoseSpike(
  spikeAmount: number,
  mealFoods: FoodItem[]
): SpikeRootCause {
  // 혈당 지수 × 양 = 혈당 부하 (Glycemic Load) 계산
  const foodsWithGL = mealFoods.map(f => ({
    ...f,
    glycemicLoad: (f.glycemicIndex / 100) * f.carbs * f.quantity,
    score: ((f.glycemicIndex / 100) * f.carbs * f.quantity) + (f.sodium > 800 ? 5 : 0),
  }));

  // 혈당 부하 높은 순으로 정렬
  const sorted = [...foodsWithGL].sort((a, b) => b.score - a.score);

  const primaryCulprit = sorted[0]?.name ?? '알 수 없음';
  const secondaryCulprits = sorted.slice(1, 3).map(f => f.name);

  const totalCarbs = mealFoods.reduce((sum, f) => sum + f.carbs * f.quantity, 0);
  const totalGL = foodsWithGL.reduce((sum, f) => sum + f.glycemicLoad, 0);

  // 원인별 추천 메시지
  let recommendation = '';
  if (sorted[0]?.glycemicIndex >= 70) {
    recommendation = `${primaryCulprit}의 혈당 지수(GI)가 높습니다. 다음번에는 통곡물 대체나 섭취량 절반 줄이기를 시도해보세요!`;
  } else if (sorted[0]?.carbs > 40) {
    recommendation = `${primaryCulprit}의 탄수화물 함량이 높습니다. 단백질(달걀, 두부)을 먼저 드신 후 탄수화물을 섭취하면 혈당 상승을 줄일 수 있어요.`;
  } else {
    recommendation = `식후 15분 가벼운 스트레칭이나 10분 산책이 혈당 안정에 도움이 됩니다. 지금 바로 시작해보세요! 🚶`;
  }

  return {
    mealId: '',
    spikeAmount,
    primaryCulprit,
    secondaryCulprits,
    carbLoad: totalCarbs,
    glycemicLoad: Math.round(totalGL),
    recommendation,
  };
}

// ======================================================
// 4. 혈당 예측 모델 (식단 입력 후 예상 혈당 시뮬레이션)
// ======================================================
export function predictGlucoseResponse(
  foods: FoodItem[],
  currentGlucose: number = 100,
  userSensitivityFactor: number = 1.0 // 개인 민감도 (기본값 1.0)
): GlucosePrediction {
  const totalCarbs = foods.reduce((sum, f) => sum + f.carbs * f.quantity, 0);
  const avgGI = foods.length > 0
    ? foods.reduce((sum, f) => sum + f.glycemicIndex, 0) / foods.length
    : 55;

  // 혈당 상승 추정 공식 (단순화된 모델)
  // GL = (GI / 100) * carbs
  const glycemicLoad = (avgGI / 100) * totalCarbs;
  
  // 경험적 상수: GL 1 단위당 약 2-3 mg/dL 상승
  const baseSpike = glycemicLoad * 2.5 * userSensitivityFactor;

  // 시간별 혈당 곡선 (정규분포 근사)
  const predicted30m = Math.round(currentGlucose + baseSpike * 0.85);
  const predicted1h = Math.round(currentGlucose + baseSpike * 1.0);
  const predicted2h = Math.round(currentGlucose + baseSpike * 0.4);

  const maxSpike = baseSpike;
  const riskLevel = classifyGlucotype(maxSpike);

  const recommendations = generatePredictiveRecommendations(
    foods,
    riskLevel,
    maxSpike,
    currentGlucose
  );

  return {
    mealId: '',
    foods,
    predictedBaseline: currentGlucose,
    predicted30m,
    predicted1h,
    predicted2h,
    riskLevel,
    recommendations,
  };
}

// ======================================================
// 5. 예측 기반 행동 지침 생성
// ======================================================
function generatePredictiveRecommendations(
  foods: FoodItem[],
  riskLevel: GlucotypeScore,
  predictedSpike: number,
  currentGlucose: number
): ActionableInsight[] {
  const insights: ActionableInsight[] = [];
  const now = new Date();

  if (riskLevel === 'red') {
    insights.push({
      id: `pred_${Date.now()}_1`,
      type: 'warning',
      title: '⚠️ 혈당 급상승 예측',
      message: `현재 식단으로 혈당이 ${Math.round(predictedSpike)} mg/dL 상승할 것으로 예측됩니다. 식사 후 15분 이내에 10분 이상 걷는 것을 강력히 권장합니다.`,
      emoji: '⚠️',
      actionLabel: '운동 타이머 시작',
      createdAt: now,
      isRead: false,
    });

    // 고위험 식품 경고
    const highGIFoods = foods.filter(f => f.glycemicIndex >= 70);
    if (highGIFoods.length > 0) {
      insights.push({
        id: `pred_${Date.now()}_2`,
        type: 'spike_alert',
        title: '🚨 고혈당 지수 식품 감지',
        message: `${highGIFoods.map(f => f.name).join(', ')}의 혈당 지수가 높습니다. 다음번엔 양을 절반으로 줄이거나 단백질을 먼저 드세요.`,
        emoji: '🚨',
        createdAt: now,
        isRead: false,
      });
    }
  } else if (riskLevel === 'yellow') {
    insights.push({
      id: `pred_${Date.now()}_3`,
      type: 'recommendation',
      title: '💛 혈당 주의 구간',
      message: `식후 30분 정도 가벼운 산책을 하시면 혈당 상승폭을 15-20% 낮출 수 있습니다. 지금 바로 준비해보세요!`,
      emoji: '💛',
      actionLabel: '15분 타이머 설정',
      createdAt: now,
      isRead: false,
    });
  } else {
    insights.push({
      id: `pred_${Date.now()}_4`,
      type: 'achievement',
      title: '✅ 훌륭한 식단 선택!',
      message: `현재 식단은 혈당 관리에 매우 적합합니다. 이 식단 패턴을 유지하세요!`,
      emoji: '✅',
      createdAt: now,
      isRead: false,
    });
  }

  return insights;
}

// ======================================================
// 6. 시간 내 혈당 유지율 계산 (TIR - Time In Range)
// ======================================================
export function calculateTimeInRange(
  readings: GlucoseReading[],
  targetMin: number,
  targetMax: number
): number {
  if (readings.length === 0) return 0;
  const inRange = readings.filter(r => r.value >= targetMin && r.value <= targetMax).length;
  return Math.round((inRange / readings.length) * 100);
}

// ======================================================
// 7. 주간 트렌드 분석
// ======================================================
export function analyzeWeeklyTrend(readings: GlucoseReading[]): {
  averageGlucose: number;
  highestGlucose: number;
  lowestGlucose: number;
  spikeCount: number;
  trend: 'improving' | 'stable' | 'worsening';
} {
  if (readings.length === 0) {
    return { averageGlucose: 0, highestGlucose: 0, lowestGlucose: 0, spikeCount: 0, trend: 'stable' };
  }

  const values = readings.map(r => r.value);
  const averageGlucose = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const highestGlucose = Math.max(...values);
  const lowestGlucose = Math.min(...values);
  const spikeCount = values.filter(v => v > 180).length;

  // 최근 3일 vs 이전 4일 평균 비교로 트렌드 판단
  const sorted = [...readings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const half = Math.floor(sorted.length / 2);
  const firstHalfAvg = sorted.slice(0, half).reduce((sum, r) => sum + r.value, 0) / (half || 1);
  const secondHalfAvg = sorted.slice(half).reduce((sum, r) => sum + r.value, 0) / (sorted.length - half || 1);

  let trend: 'improving' | 'stable' | 'worsening' = 'stable';
  if (secondHalfAvg < firstHalfAvg - 5) trend = 'improving';
  else if (secondHalfAvg > firstHalfAvg + 5) trend = 'worsening';

  return { averageGlucose, highestGlucose, lowestGlucose, spikeCount, trend };
}
