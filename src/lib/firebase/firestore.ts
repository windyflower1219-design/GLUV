// =====================================================================
// Data layer: Neon PostgreSQL (API routes) + in-memory read cache
// Firebase SDK 의존성 제거. 함수 시그니처는 기존과 동일하게 유지.
// =====================================================================

import type { Meal, GlucoseReading, ParseCorrection } from '@/types';

// =====================
// In-memory 읽기 캐시 (30초 TTL)
// =====================
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const READ_CACHE = new Map<string, CacheEntry<any>>();
const TTL = 30_000;

function getCache<T>(key: string): T | null {
  const hit = READ_CACHE.get(key);
  if (!hit || hit.expiresAt < Date.now()) { READ_CACHE.delete(key); return null; }
  return hit.data as T;
}
function setCache(key: string, data: any) {
  READ_CACHE.set(key, { data, expiresAt: Date.now() + TTL });
}
function invalidateCache(prefix: string) {
  for (const key of Array.from(READ_CACHE.keys())) {
    if (key.startsWith(prefix)) READ_CACHE.delete(key);
  }
}

// ID 생성 (crypto.randomUUID는 브라우저/Node 모두 지원)
function genId(prefix: string) {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now();
  return `${prefix}_${rand}`;
}

// DB row → 앱 타입 변환 헬퍼
function rowToMeal(row: any): Meal {
  return {
    id: row.id,
    userId: row.user_id,
    timestamp: new Date(row.timestamp),
    mealType: row.meal_type,
    rawVoiceInput: row.raw_voice_input,
    parsedFoods: typeof row.parsed_foods === 'string'
      ? JSON.parse(row.parsed_foods)
      : (row.parsed_foods ?? []),
    totalCarbs: Number(row.total_carbs),
    totalCalories: Number(row.total_calories),
    glucotypeScore: row.glucotype_score,
  };
}

function rowToGlucose(row: any): GlucoseReading {
  return {
    id: row.id,
    userId: row.user_id,
    timestamp: new Date(row.timestamp),
    value: Number(row.value),
    measurementType: row.measurement_type,
    linkedMealId: row.linked_meal_id ?? undefined,
    notes: row.notes ?? undefined,
  };
}

// =====================
// 식단 관련
// =====================
export const saveMeal = async (meal: Omit<Meal, 'id'>): Promise<string> => {
  const id = genId('meal');
  const res = await fetch('/api/meals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      userId: meal.userId,
      timestamp: meal.timestamp.toISOString(),
      mealType: meal.mealType,
      rawVoiceInput: meal.rawVoiceInput,
      parsedFoods: meal.parsedFoods,
      totalCarbs: meal.totalCarbs,
      totalCalories: meal.totalCalories,
      glucotypeScore: meal.glucotypeScore,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '식단 저장 실패');
  }
  invalidateCache('meals|');
  return id;
};

export const getMeals = async (userId: string, date?: Date): Promise<Meal[]> => {
  const cacheK = `meals|${userId}|${date ? date.toDateString() : 'recent'}`;
  const cached = getCache<Meal[]>(cacheK);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({ userId });
    if (date) {
      params.set('date', date.toISOString().slice(0, 10));
    } else {
      params.set('days', '30');
    }
    const res = await fetch(`/api/meals?${params}`);
    const rows: any[] = await res.json();
    const result = Array.isArray(rows) ? rows.map(rowToMeal) : [];
    setCache(cacheK, result);
    return result;
  } catch (error) {
    console.warn('getMeals 실패:', error);
    return [];
  }
};

export const deleteMeal = async (mealId: string): Promise<void> => {
  const res = await fetch(`/api/meals/${mealId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '식단 삭제 실패');
  }
  invalidateCache('meals|');
};

export const updateMeal = async (mealId: string, updates: Partial<Omit<Meal, 'id'>>): Promise<void> => {
  const payload: any = {};
  if (updates.parsedFoods !== undefined) payload.parsedFoods = updates.parsedFoods;
  if (updates.totalCarbs !== undefined) payload.totalCarbs = updates.totalCarbs;
  if (updates.totalCalories !== undefined) payload.totalCalories = updates.totalCalories;
  if (updates.glucotypeScore !== undefined) payload.glucotypeScore = updates.glucotypeScore;
  if (updates.timestamp instanceof Date) payload.timestamp = updates.timestamp.toISOString();

  const res = await fetch(`/api/meals/${mealId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '식단 수정 실패');
  }
  invalidateCache('meals|');
};

// =====================
// 혈당 관련
// =====================
export const saveGlucose = async (reading: Omit<GlucoseReading, 'id'>): Promise<string> => {
  const id = genId('glucose');
  const res = await fetch('/api/glucose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      userId: reading.userId,
      timestamp: reading.timestamp.toISOString(),
      value: reading.value,
      measurementType: reading.measurementType,
      linkedMealId: reading.linkedMealId,
      notes: reading.notes,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '혈당 저장 실패');
  }
  invalidateCache('glucose|');
  return id;
};

export const getGlucoseReadings = async (userId: string, hours: number = 24): Promise<GlucoseReading[]> => {
  const bucket = Math.round(hours);
  const cacheK = `glucose|${userId}|${bucket}`;
  const cached = getCache<GlucoseReading[]>(cacheK);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({ userId, hours: String(bucket) });
    const res = await fetch(`/api/glucose?${params}`);
    const rows: any[] = await res.json();
    const result = Array.isArray(rows) ? rows.map(rowToGlucose) : [];
    setCache(cacheK, result);
    return result;
  } catch (error) {
    console.warn('getGlucoseReadings 실패:', error);
    return [];
  }
};

export const deleteGlucose = async (readingId: string): Promise<void> => {
  const res = await fetch(`/api/glucose/${readingId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '혈당 삭제 실패');
  }
  invalidateCache('glucose|');
};

export const updateGlucose = async (readingId: string, updates: Partial<Omit<GlucoseReading, 'id'>>): Promise<void> => {
  const payload: any = {};
  if (updates.value !== undefined) payload.value = updates.value;
  if (updates.measurementType !== undefined) payload.measurementType = updates.measurementType;
  if (updates.timestamp instanceof Date) payload.timestamp = updates.timestamp.toISOString();
  if (updates.notes !== undefined) payload.notes = updates.notes;

  const res = await fetch(`/api/glucose/${readingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '혈당 수정 실패');
  }
  invalidateCache('glucose|');
};

// =====================
// 파싱 오인식 학습 로그 (best-effort)
// =====================
export const saveParseCorrection = async (correction: Omit<ParseCorrection, 'id'>): Promise<string | null> => {
  if (!correction.rawVoiceInput?.trim()) return null;
  try {
    const id = genId('pc');
    await fetch('/api/parse-corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...correction, timestamp: correction.timestamp.toISOString() }),
    });
    return id;
  } catch {
    return null;
  }
};

// =====================
// 사용자 프로필
// =====================
export interface UserProfile {
  targetKcal: number;
  targetGlucoseMin: number;
  targetGlucoseMax: number;
  updatedAt?: Date;
}

const DEFAULT_PROFILE: UserProfile = {
  targetKcal: 2000,
  targetGlucoseMin: 70,
  targetGlucoseMax: 140,
};

export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const cacheK = `profile|${userId}`;
  const cached = getCache<UserProfile>(cacheK);
  if (cached) return cached;

  try {
    const res = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    const profile: UserProfile = {
      targetKcal: data.targetKcal ?? DEFAULT_PROFILE.targetKcal,
      targetGlucoseMin: data.targetGlucoseMin ?? DEFAULT_PROFILE.targetGlucoseMin,
      targetGlucoseMax: data.targetGlucoseMax ?? DEFAULT_PROFILE.targetGlucoseMax,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    };
    setCache(cacheK, profile);
    return profile;
  } catch {
    return DEFAULT_PROFILE;
  }
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...updates }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '프로필 저장 실패');
  }
  invalidateCache('profile|');
};

// 캐시 수동 초기화 (로그아웃 시)
export const clearFirestoreCache = () => {
  READ_CACHE.clear();
};
