import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { app } from './config';
import type { Meal, GlucoseReading, ParseCorrection } from '@/types';

const db = getFirestore(app);

// ---- Promise Timeout Wrapper ----
// 쓰기(writes)는 여전히 5초 상한, 읽기(reads)는 2.5초로 단축해
// Firebase가 일시적으로 느릴 때 UI가 너무 오래 멈추지 않도록 함.
const withTimeout = <T>(promise: Promise<T>, ms: number = 2500): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Firebase operation timed out.')), ms)),
  ]);
};

// ---- Local Storage Fallback Helpers ----
const getLocalData = (key: string) => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalData = (key: string, data: any[]) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  }
};

// =====================
// In-memory 읽기 캐시
// - TTL 내에서는 Firestore 호출을 완전히 생략하여 페이지 전환이 즉시 반응.
// - 쓰기(save/update/delete)가 일어나면 해당 prefix를 invalidate.
// =====================
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const READ_CACHE = new Map<string, CacheEntry<any>>();
const READ_CACHE_TTL_MS = 30_000; // 30초

const getCache = <T>(key: string): T | null => {
  const hit = READ_CACHE.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    READ_CACHE.delete(key);
    return null;
  }
  return hit.data as T;
};

const setCache = (key: string, data: any) => {
  READ_CACHE.set(key, { data, expiresAt: Date.now() + READ_CACHE_TTL_MS });
};

const invalidateCache = (prefix: string) => {
  for (const key of Array.from(READ_CACHE.keys())) {
    if (key.startsWith(prefix)) READ_CACHE.delete(key);
  }
};

const dayKey = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
};

// =====================
// 식단 관련
// =====================
export const saveMeal = async (meal: Omit<Meal, 'id'>) => {
  try {
    const docRef = await withTimeout(
      addDoc(collection(db, 'meals'), {
        ...meal,
        timestamp: Timestamp.fromDate(meal.timestamp),
      }),
      5000,
    );
    // 해당 날짜 cache 무효화 (간단하게 meals 전체 prefix 무효화)
    invalidateCache('meals|');
    return docRef.id;
  } catch (error) {
    console.warn('Firebase saveMeal error, falling back to localStorage:', error);
    if (typeof window !== 'undefined') {
      const id = `local_meal_${Date.now()}`;
      const meals = getLocalData('gluv_meals');
      meals.push({ ...meal, id, timestamp: meal.timestamp.toISOString() });
      saveLocalData('gluv_meals', meals);
      invalidateCache('meals|');
      return id;
    }
    throw error;
  }
};

export const getMeals = async (userId: string, date?: Date) => {
  const cacheK = `meals|${userId}|${date ? dayKey(date) : 'recent'}`;
  const cached = getCache<Meal[]>(cacheK);
  if (cached) return cached;

  const startOfDay = date ? new Date(date) : new Date();
  if (date) {
    startOfDay.setHours(0, 0, 0, 0);
  } else {
    startOfDay.setDate(startOfDay.getDate() - 30); // 기본 최근 30일
  }
  
  const endOfDay = date ? new Date(date) : new Date();
  if (date) {
    endOfDay.setHours(23, 59, 59, 999);
  } else {
    endOfDay.setHours(23, 59, 59, 999);
  }

  let fbMeals: Meal[] = [];
  try {
    const q = query(
      collection(db, 'meals'),
      where('userId', '==', userId),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
      where('timestamp', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('timestamp', 'desc'),
    );
    const querySnapshot = await withTimeout(getDocs(q));
    fbMeals = querySnapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      timestamp: (d.data().timestamp as Timestamp).toDate(),
    })) as Meal[];
  } catch (error) {
    console.warn('Firebase getMeals error, using only local data:', error);
  }

  let result: Meal[] = fbMeals;
  if (typeof window !== 'undefined') {
    const localMeals = getLocalData('gluv_meals');
    const filteredLocal = localMeals
      .map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
      .filter((m: Meal) => m.userId === userId && m.timestamp >= startOfDay && m.timestamp <= endOfDay);

    // id 기준으로 중복 제거 후 합침
    const fbIds = new Set(fbMeals.map((m: Meal) => m.id));
    const uniqueLocal = filteredLocal.filter((m: Meal) => !fbIds.has(m.id));

    result = [...fbMeals, ...uniqueLocal].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  setCache(cacheK, result);
  return result;
};

export const deleteMeal = async (mealId: string) => {
  try {
    if (!mealId.startsWith('local_')) {
      await withTimeout(deleteDoc(doc(db, 'meals', mealId)), 5000);
    }
  } catch (error) {
    console.warn('Firebase deleteMeal error:', error);
  } finally {
    if (typeof window !== 'undefined') {
      const meals = getLocalData('gluv_meals');
      const filtered = meals.filter((m: any) => m.id !== mealId);
      saveLocalData('gluv_meals', filtered);
    }
    invalidateCache('meals|');
  }
};

export const updateMeal = async (mealId: string, updates: Partial<Omit<Meal, 'id'>>) => {
  // Firestore 업데이트용 페이로드 (timestamp가 포함된 경우 Timestamp로 변환)
  const payload: any = { ...updates };
  if (updates.timestamp instanceof Date) {
    payload.timestamp = Timestamp.fromDate(updates.timestamp);
  }

  try {
    if (!mealId.startsWith('local_')) {
      await withTimeout(updateDoc(doc(db, 'meals', mealId), payload), 5000);
    }
  } catch (error) {
    console.warn('Firebase updateMeal error, falling back to localStorage:', error);
  } finally {
    // 로컬 캐시에 같은 id가 있으면 거기도 반영
    if (typeof window !== 'undefined') {
      const meals = getLocalData('gluv_meals');
      const idx = meals.findIndex((m: any) => m.id === mealId);
      if (idx >= 0) {
        const merged = { ...meals[idx], ...updates };
        if (updates.timestamp instanceof Date) {
          merged.timestamp = (updates.timestamp as Date).toISOString();
        }
        meals[idx] = merged;
        saveLocalData('gluv_meals', meals);
      }
    }
    invalidateCache('meals|');
  }
};

// =====================
// 혈당 관련
// =====================
export const saveGlucose = async (reading: Omit<GlucoseReading, 'id'>) => {
  try {
    const docRef = await withTimeout(
      addDoc(collection(db, 'glucose_readings'), {
        ...reading,
        timestamp: Timestamp.fromDate(reading.timestamp),
      }),
      5000,
    );
    invalidateCache('glucose|');
    return docRef.id;
  } catch (error) {
    console.warn('Firebase saveGlucose error, falling back to localStorage:', error);
    if (typeof window !== 'undefined') {
      const id = `local_glucose_${Date.now()}`;
      const readings = getLocalData('gluv_glucose');
      readings.push({ ...reading, id, timestamp: reading.timestamp.toISOString() });
      saveLocalData('gluv_glucose', readings);
      invalidateCache('glucose|');
      return id;
    }
    throw error;
  }
};

export const getGlucoseReadings = async (userId: string, hours: number = 24) => {
  // hours를 10분 단위로 반올림해 유사한 요청들은 같은 cache key를 공유
  const bucket = Math.round(hours);
  const cacheK = `glucose|${userId}|${bucket}`;
  const cached = getCache<GlucoseReading[]>(cacheK);
  if (cached) return cached;

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hours);

  let fbReadings: GlucoseReading[] = [];
  try {
    const q = query(
      collection(db, 'glucose_readings'),
      where('userId', '==', userId),
      where('timestamp', '>=', Timestamp.fromDate(cutoff)),
      orderBy('timestamp', 'asc'),
    );
    const querySnapshot = await withTimeout(getDocs(q));
    fbReadings = querySnapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      timestamp: (d.data().timestamp as Timestamp).toDate(),
    })) as GlucoseReading[];
  } catch (error) {
    console.warn('Firebase getGlucoseReadings error, using only local data:', error);
  }

  let result: GlucoseReading[] = fbReadings;
  if (typeof window !== 'undefined') {
    const local = getLocalData('gluv_glucose');
    const filteredLocal = local
      .map((r: any) => ({ ...r, timestamp: new Date(r.timestamp) }))
      .filter((r: GlucoseReading) => r.userId === userId && r.timestamp >= cutoff);

    // id 기준으로 중복 제거 후 합침
    const fbIds = new Set(fbReadings.map((r: GlucoseReading) => r.id));
    const uniqueLocal = filteredLocal.filter((r: GlucoseReading) => !fbIds.has(r.id));

    result = [...fbReadings, ...uniqueLocal].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  setCache(cacheK, result);
  return result;
};

export const deleteGlucose = async (readingId: string) => {
  try {
    if (!readingId.startsWith('local_')) {
      await withTimeout(deleteDoc(doc(db, 'glucose_readings', readingId)), 5000);
    }
  } catch (error) {
    console.warn('Firebase deleteGlucose error:', error);
  } finally {
    if (typeof window !== 'undefined') {
      const readings = getLocalData('gluv_glucose');
      const filtered = readings.filter((r: any) => r.id !== readingId);
      saveLocalData('gluv_glucose', filtered);
    }
    invalidateCache('glucose|');
  }
};

export const updateGlucose = async (
  readingId: string,
  updates: Partial<Omit<GlucoseReading, 'id'>>,
) => {
  const payload: any = { ...updates };
  if (updates.timestamp instanceof Date) {
    payload.timestamp = Timestamp.fromDate(updates.timestamp);
  }

  try {
    if (!readingId.startsWith('local_')) {
      await withTimeout(updateDoc(doc(db, 'glucose_readings', readingId), payload), 5000);
    }
  } catch (error) {
    console.warn('Firebase updateGlucose error:', error);
  } finally {
    if (typeof window !== 'undefined') {
      const readings = getLocalData('gluv_glucose');
      const idx = readings.findIndex((r: any) => r.id === readingId);
      if (idx >= 0) {
        const merged = { ...readings[idx], ...updates };
        if (updates.timestamp instanceof Date) {
          merged.timestamp = (updates.timestamp as Date).toISOString();
        }
        readings[idx] = merged;
        saveLocalData('gluv_glucose', readings);
      }
    }
    invalidateCache('glucose|');
  }
};

// ============================
// 파싱 오인식 학습 로그
// - 사용자가 저장 시점에 고친 내역을 parse_corrections 컬렉션에 쌓아
//   주기적으로 Gemini 프롬프트/로컬 사전 튜닝에 활용한다.
// - best-effort: 실패해도 사용자 플로우엔 절대 영향 주지 않음.
// ============================
export const saveParseCorrection = async (correction: Omit<ParseCorrection, 'id'>): Promise<string | null> => {
  // 입력이 비어있거나 변경이 없으면 스킵
  if (!correction.rawVoiceInput?.trim()) return null;
  const sameNames =
    correction.parsedNames.length === correction.correctedNames.length &&
    correction.parsedNames.every((n, i) => n === correction.correctedNames[i]);
  if (sameNames && correction.correctionType !== 'accepted_as_is') return null;

  try {
    const docRef = await withTimeout(
      addDoc(collection(db, 'parse_corrections'), {
        ...correction,
        timestamp: Timestamp.fromDate(correction.timestamp),
      }),
      3000,
    );
    return docRef.id;
  } catch (error) {
    console.warn('saveParseCorrection failed, storing locally:', error);
    if (typeof window !== 'undefined') {
      try {
        const id = `local_pc_${Date.now()}`;
        const arr = getLocalData('gluv_parse_corrections');
        arr.push({ ...correction, id, timestamp: correction.timestamp.toISOString() });
        if (arr.length > 200) arr.splice(0, arr.length - 200);
        saveLocalData('gluv_parse_corrections', arr);
        return id;
      } catch {}
    }
    return null;
  }
};

// ============================
// 사용자 프로필 및 설정
// ============================
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
    const q = query(collection(db, 'users'), where('userId', '==', userId));
    const querySnapshot = await withTimeout(getDocs(q));
    
    if (querySnapshot.empty) {
      return DEFAULT_PROFILE;
    }

    const data = querySnapshot.docs[0].data();
    const profile = {
      ...DEFAULT_PROFILE,
      ...data,
      updatedAt: data.updatedAt?.toDate(),
    } as UserProfile;

    setCache(cacheK, profile);
    return profile;
  } catch (error) {
    console.warn('getUserProfile failed, using default:', error);
    return DEFAULT_PROFILE;
  }
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
  try {
    const q = query(collection(db, 'users'), where('userId', '==', userId));
    const querySnapshot = await withTimeout(getDocs(q));
    
    const payload = {
      ...updates,
      userId,
      updatedAt: Timestamp.now(),
    };

    if (querySnapshot.empty) {
      await withTimeout(addDoc(collection(db, 'users'), payload));
    } else {
      const docId = querySnapshot.docs[0].id;
      await withTimeout(updateDoc(doc(db, 'users', docId), payload));
    }
    
    invalidateCache('profile|');
  } catch (error) {
    console.error('updateUserProfile failed:', error);
    throw error;
  }
};

// 캐시를 수동으로 비워야 할 때 사용 (로그아웃 등)
export const clearFirestoreCache = () => {
  READ_CACHE.clear();
};
