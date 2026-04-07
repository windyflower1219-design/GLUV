'use client';

import { useCallback } from 'react';
import { saveMeal, saveGlucose } from '@/lib/firebase/firestore';
import { predictGlucoseResponse } from '@/lib/algorithms/glucoseAnalysis';
import type { FoodItem, Meal, MeasurementType, MealType } from '@/types';

function getMealType(): MealType {
  const h = new Date().getHours();
  if (h >= 6 && h < 10) return 'breakfast';
  if (h >= 10 && h < 15) return 'lunch';
  if (h >= 15 && h < 19) return 'dinner';
  return 'snack';
}

export const useUnifiedStorage = () => {
  const saveUnifiedRecord = useCallback(async (
    foods: Partial<FoodItem>[], 
    rawText: string,
    glucose?: { value: number; type: MeasurementType }
  ) => {
    const fullFoods = foods as FoodItem[];
    const prediction = predictGlucoseResponse(fullFoods, 100);
    
    try {
      // 1. 식단 저장
      if (fullFoods.length > 0) {
        const mealData: Omit<Meal, 'id'> = {
          userId: 'demo',
          timestamp: new Date(),
          mealType: getMealType(),
          rawVoiceInput: rawText,
          parsedFoods: fullFoods,
          totalCarbs: fullFoods.reduce((s, f) => s + (f.carbs || 0) * (f.quantity || 1), 0),
          totalCalories: fullFoods.reduce((s, f) => s + (f.calories || 0) * (f.quantity || 1), 0),
          glucotypeScore: prediction.riskLevel,
        };
        await saveMeal(mealData);
      }

      // 2. 혈당 저장
      if (glucose) {
        await saveGlucose({
          userId: 'demo',
          timestamp: new Date(),
          value: glucose.value,
          measurementType: glucose.type,
          notes: `음성 입력으로 자동 기록: "${rawText}"`
        });
      }
      return true;
    } catch (error) {
      console.error('Error in unified storage:', error);
      throw error;
    }
  }, []);

  return { saveUnifiedRecord };
};
