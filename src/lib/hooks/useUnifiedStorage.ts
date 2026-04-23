'use client';

import { useCallback, useState } from 'react';
import { saveMeal, saveGlucose } from '@/lib/firebase/firestore';
import { predictGlucoseResponse } from '@/lib/algorithms/glucoseAnalysis';
import { useAuth } from '@/context/AuthContext';
import type { FoodItem, Meal, MeasurementType, MealType } from '@/types';

function getMealTypeFromTime(date: Date): MealType {
  const h = date.getHours();
  if (h >= 5 && h < 10) return 'breakfast';
  if (h >= 10 && h < 15) return 'lunch';
  if (h >= 15 && h < 21) return 'dinner';
  return 'snack';
}

export const useUnifiedStorage = () => {
  const { user } = useAuth();
  const userId = user?.uid || 'guest';

  const saveUnifiedRecord = useCallback(async (
    foods: Partial<FoodItem>[], 
    rawText: string,
    glucose?: { value: number; type: MeasurementType },
    timestamp: Date = new Date()
  ) => {
    const fullFoods = foods as FoodItem[];
    const prediction = predictGlucoseResponse(fullFoods, 100);
    
    try {
      // 1, 2번을 병렬로 실행 (순차 await 제거 → 네트워크 지연 중첩 X)
      const tasks: Promise<any>[] = [];

      if (fullFoods.length > 0) {
        const mealData: Omit<Meal, 'id'> = {
          userId: userId,
          timestamp: timestamp,
          mealType: getMealTypeFromTime(timestamp),
          rawVoiceInput: rawText,
          parsedFoods: fullFoods,
          totalCarbs: fullFoods.reduce((s, f) => s + (f.carbs || 0) * (f.quantity || 1), 0),
          totalCalories: fullFoods.reduce((s, f) => s + (f.calories || 0) * (f.quantity || 1), 0),
          glucotypeScore: prediction.riskLevel,
        };
        tasks.push(saveMeal(mealData));
      }

      if (glucose) {
        tasks.push(
          saveGlucose({
            userId: userId,
            timestamp: timestamp,
            value: glucose.value,
            measurementType: glucose.type,
            notes: `음성 입력으로 자동 기록: "${rawText}"`,
          }),
        );
      }

      await Promise.all(tasks);
      return true;
    } catch (error) {
      console.error('Error in unified storage:', error);
      throw error;
    }
  }, [userId]);

  return { saveUnifiedRecord };
};
