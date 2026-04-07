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

// 식단 관련
export const saveMeal = async (meal: Omit<Meal, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'meals'), {
      ...meal,
      timestamp: Timestamp.fromDate(meal.timestamp),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving meal:', error);
    throw error;
  }
};

export const getMeals = async (userId: string, date: Date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, 'meals'),
    where('userId', '==', userId),
    where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
    where('timestamp', '<=', Timestamp.fromDate(endOfDay)),
    orderBy('timestamp', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: (doc.data().timestamp as Timestamp).toDate(),
  })) as Meal[];
};

// 혈당 관련
export const saveGlucose = async (reading: Omit<GlucoseReading, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'glucose_readings'), {
      ...reading,
      timestamp: Timestamp.fromDate(reading.timestamp),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving glucose reading:', error);
    throw error;
  }
};

export const getGlucoseReadings = async (userId: string, hours: number = 24) => {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hours);

  const q = query(
    collection(db, 'glucose_readings'),
    where('userId', '==', userId),
    where('timestamp', '>=', Timestamp.fromDate(cutoff)),
    orderBy('timestamp', 'asc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: (doc.data().timestamp as Timestamp).toDate(),
  })) as GlucoseReading[];
};

export const deleteMeal = async (mealId: string) => {
  await deleteDoc(doc(db, 'meals', mealId));
};
