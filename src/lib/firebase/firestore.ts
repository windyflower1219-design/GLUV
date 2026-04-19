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
  deleteDoc
} from 'firebase/firestore';
import { app } from './config';
import type { Meal, GlucoseReading } from '@/types';

const db = getFirestore(app);

// ---- Promise Timeout Wrapper ----
const withTimeout = <T>(promise: Promise<T>, ms: number = 5000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Firebase operation timed out.')), ms))
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
// 식단 관련
// =====================
export const saveMeal = async (meal: Omit<Meal, 'id'>) => {
  try {
    const docRef = await withTimeout(addDoc(collection(db, 'meals'), {
      ...meal,
      timestamp: Timestamp.fromDate(meal.timestamp),
    }));
    return docRef.id;
  } catch (error) {
    console.warn('Firebase saveMeal error, falling back to localStorage:', error);
    if (typeof window !== 'undefined') {
      const id = `local_meal_${Date.now()}`;
      const meals = getLocalData('gluv_meals');
      meals.push({ ...meal, id, timestamp: meal.timestamp.toISOString() });
      saveLocalData('gluv_meals', meals);
      return id;
    }
    throw error;
  }
};

export const getMeals = async (userId: string, date: Date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  let fbMeals: Meal[] = [];
  try {
    const q = query(
      collection(db, 'meals'),
      where('userId', '==', userId),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
      where('timestamp', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('timestamp', 'desc')
    );
    const querySnapshot = await withTimeout(getDocs(q));
    fbMeals = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: (doc.data().timestamp as Timestamp).toDate(),
    })) as Meal[];
  } catch (error) {
    console.warn('Firebase getMeals error, using only local data:', error);
  }

  if (typeof window !== 'undefined') {
    const localMeals = getLocalData('gluv_meals');
    const filteredLocal = localMeals
      .map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
      .filter((m: Meal) => m.userId === userId && m.timestamp >= startOfDay && m.timestamp <= endOfDay);
    
    // id 기준으로 중복 제거 후 합침
    const fbIds = new Set(fbMeals.map((m: Meal) => m.id));
    const uniqueLocal = filteredLocal.filter((m: Meal) => !fbIds.has(m.id));
    
    return [...fbMeals, ...uniqueLocal].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  return fbMeals;
};

export const deleteMeal = async (mealId: string) => {
  try {
    if (!mealId.startsWith('local_')) {
      await withTimeout(deleteDoc(doc(db, 'meals', mealId)));
    }
  } catch (error) {
    console.warn('Firebase deleteMeal error:', error);
  } finally {
    if (typeof window !== 'undefined') {
      const meals = getLocalData('gluv_meals');
      const filtered = meals.filter((m: any) => m.id !== mealId);
      saveLocalData('gluv_meals', filtered);
    }
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
      await withTimeout(updateDoc(doc(db, 'meals', mealId), payload));
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
  }
};

// =====================
// 혈당 관련
// =====================
export const saveGlucose = async (reading: Omit<GlucoseReading, 'id'>) => {
  try {
    const docRef = await withTimeout(addDoc(collection(db, 'glucose_readings'), {
      ...reading,
      timestamp: Timestamp.fromDate(reading.timestamp),
    }));
    return docRef.id;
  } catch (error) {
    console.warn('Firebase saveGlucose error, falling back to localStorage:', error);
    if (typeof window !== 'undefined') {
      const id = `local_glucose_${Date.now()}`;
      const readings = getLocalData('gluv_glucose');
      readings.push({ ...reading, id, timestamp: reading.timestamp.toISOString() });
      saveLocalData('gluv_glucose', readings);
      return id;
    }
    throw error;
  }
};

export const getGlucoseReadings = async (userId: string, hours: number = 24) => {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hours);

  let fbReadings: GlucoseReading[] = [];
  try {
    const q = query(
      collection(db, 'glucose_readings'),
      where('userId', '==', userId),
      where('timestamp', '>=', Timestamp.fromDate(cutoff)),
      orderBy('timestamp', 'asc')
    );
    const querySnapshot = await withTimeout(getDocs(q));
    fbReadings = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: (doc.data().timestamp as Timestamp).toDate(),
    })) as GlucoseReading[];
  } catch (error) {
    console.warn('Firebase getGlucoseReadings error, using only local data:', error);
  }

  if (typeof window !== 'undefined') {
    const local = getLocalData('gluv_glucose');
    const filteredLocal = local
      .map((r: any) => ({ ...r, timestamp: new Date(r.timestamp) }))
      .filter((r: GlucoseReading) => r.userId === userId && r.timestamp >= cutoff);

    // id 기준으로 중복 제거 후 합침
    const fbIds = new Set(fbReadings.map((r: GlucoseReading) => r.id));
    const uniqueLocal = filteredLocal.filter((r: GlucoseReading) => !fbIds.has(r.id));

    return [...fbReadings, ...uniqueLocal].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  return fbReadings;
};

export const deleteGlucose = async (readingId: string) => {
  try {
    if (!readingId.startsWith('local_')) {
      await withTimeout(deleteDoc(doc(db, 'glucose_readings', readingId)));
    }
  } catch (error) {
    console.warn('Firebase deleteGlucose error:', error);
  } finally {
    if (typeof window !== 'undefined') {
      const readings = getLocalData('gluv_glucose');
      const filtered = readings.filter((r: any) => r.id !== readingId);
      saveLocalData('gluv_glucose', filtered);
    }
  }
};

export const updateGlucose = async (
  readingId: string,
  updates: Partial<Omit<GlucoseReading, 'id'>>
) => {
  const payload: any = { ...updates };
  if (updates.timestamp instanceof Date) {
    payload.timestamp = Timestamp.fromDate(updates.timestamp);
  }

  try {
    if (!readingId.startsWith('local_')) {
      await withTimeout(updateDoc(doc(db, 'glucose_readings', readingId), payload));
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
  }
};
