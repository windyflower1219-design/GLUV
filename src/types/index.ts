// ============================
// 핵심 타입 정의
// ============================

export type GlucotypeScore = 'green' | 'yellow' | 'red';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MeasurementType = 'fasting' | 'postmeal_30m' | 'postmeal_1h' | 'postmeal_2h' | 'random';

export interface FoodItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  carbs: number;         // 탄수화물 (g)
  calories: number;       // 칼로리 (kcal)
  glycemicIndex: number;  // 혈당 지수 (0-100)
  protein: number;        // 단백질 (g)
  fat: number;            // 지방 (g)
  sodium: number;         // 나트륨 (mg)
}

export interface Meal {
  id: string;
  userId: string;
  timestamp: Date;
  mealType: MealType;
  rawVoiceInput: string;
  parsedFoods: FoodItem[];
  totalCarbs: number;
  totalCalories: number;
  glucotypeScore: GlucotypeScore;
  imageUrl?: string;
  notes?: string;
}

export interface GlucoseReading {
  id: string;
  userId: string;
  timestamp: Date;
  value: number;            // mg/dL
  measurementType: MeasurementType;
  linkedMealId?: string;
  notes?: string;
}

export interface GlucoseCorrelation {
  mealId: string;
  baselineGlucose: number;
  spike30m: number | null;
  spike1h: number | null;
  spike2h: number | null;
  maxSpike: number;
  returnToBaseline: boolean;
  glucotypeScore: GlucotypeScore;
}

export interface SpikeRootCause {
  mealId: string;
  spikeAmount: number;
  primaryCulprit: string;     // 주요 원인 식재료
  secondaryCulprits: string[];
  carbLoad: number;
  glycemicLoad: number;
  recommendation: string;
}

export interface GlucosePrediction {
  mealId: string;
  foods: FoodItem[];
  predictedBaseline: number;
  predicted30m: number;
  predicted1h: number;
  predicted2h: number;
  riskLevel: GlucotypeScore;
  recommendations: ActionableInsight[];
}

export interface ActionableInsight {
  id: string;
  type: 'spike_alert' | 'prediction' | 'recommendation' | 'achievement' | 'warning';
  title: string;
  message: string;
  emoji: string;
  actionLabel?: string;
  actionUrl?: string;
  linkedMealId?: string;
  createdAt: Date;
  isRead: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  diabetesType: 'type1' | 'type2' | 'prediabetes' | 'none';
  targetGlucoseMin: number;   // 목표 최저 혈당
  targetGlucoseMax: number;   // 목표 최고 혈당
  weight?: number;            // kg
  height?: number;            // cm
  createdAt: Date;
}

export interface UserFoodPreference {
  foodName: string;
  defaultQuantity: number;
  defaultUnit: string;
  correctionCount: number;
  lastUsed: Date;
}

export interface DashboardSummary {
  todayMeals: Meal[];
  todayGlucoseReadings: GlucoseReading[];
  averageGlucose: number;
  timeInRange: number;        // 목표 범위 내 비율 (%)
  todayCalories: number;
  todayCarbs: number;
  latestInsight: ActionableInsight | null;
  weeklyTrend: WeeklyTrend[];
}

export interface WeeklyTrend {
  date: string;               // YYYY-MM-DD
  averageGlucose: number;
  totalCalories: number;
  totalCarbs: number;
  spikeCount: number;
}

// 음성 입력 상태
export type VoiceInputState = 'idle' | 'listening' | 'processing' | 'confirming' | 'error';

export interface VoiceParseResult {
  rawText: string;
  parsedFoods: Partial<FoodItem>[];
  glucoseValue?: number;
  detectedMeasType?: MeasurementType;
  confidenceScore: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

// 차트 데이터
export interface GlucoseChartData {
  time: string;
  glucose: number;
  mealMarker?: string;
  targetMin: number;
  targetMax: number;
}

export interface NutritionChartData {
  name: string;
  value: number;
  color: string;
}
