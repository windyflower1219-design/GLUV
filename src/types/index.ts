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
  detectedTime?: string;
  confidenceScore: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
  /**
   * 저확신 상황에서 사용자에게 보여줄 상위 후보들.
   * 1차 인식이 실패했거나 confidence가 낮을 때 활용한다.
   * - name: 제안할 표준 음식명(로컬 DB 키 또는 Gemini 추정명)
   * - confidence: 0~1 사이 상대 확신도
   * - reason?: 디버그/설명용(예: "음운 복원", "자모거리 1", "동의어")
   */
  topCandidates?: Array<{ name: string; confidence: number; reason?: string }>;
  /**
   * 서버가 어떤 모델/시도 경로로 응답을 만들었는지 기록 (선택).
   * 디버깅 + parse_corrections 로그 품질 향상용.
   */
  _diagnostics?: {
    modelUsed?: string | null;
    attempts?: Array<{ model: string; error?: string }>;
    recovery?: boolean;
    reason?: string;
  };
}

// 파싱 결과 vs 사용자 최종 입력의 차이를 기록해
// 향후 프롬프트/사전 개선에 재활용한다.
export interface ParseCorrection {
  id?: string;
  userId?: string;
  timestamp: Date;
  rawVoiceInput: string;
  /** 원래 파서가 뽑아낸 이름들 */
  parsedNames: string[];
  /** 사용자가 최종 저장한 이름들 */
  correctedNames: string[];
  /** 저장 시점의 confidence (API 0.9 / 로컬 0.6 / 저확신 0) */
  confidence: number;
  /** "name_edited" | "candidate_chip" | "manual_add" | "accepted_as_is" 등 */
  correctionType: 'name_edited' | 'candidate_chip' | 'manual_add' | 'accepted_as_is';
  /** 로컬 fallback 여부 판별용 (선택) */
  source?: 'server' | 'local';
  /** 어떤 모델로 파싱됐는지 (server 경로만) */
  modelUsed?: string | null;
  /** recovery pass가 개입했는지 (server 경로만) */
  recovery?: boolean;
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
