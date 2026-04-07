'use client';

import { useState, useEffect, useCallback } from 'react';
import { saveGlucose, getGlucoseReadings } from '@/lib/firebase/firestore';
import type { GlucoseReading, GlucoseChartData } from '@/types';

export function useGlucoseData(userId: string = 'demo') {
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentGlucose, setCurrentGlucose] = useState<number>(0);

  const fetchReadings = useCallback(async (showLoading = true) => {
    if (showLoading) setIsInitialLoading(true);
    try {
      const data = await getGlucoseReadings(userId, 72);
      setReadings(data);
      if (data.length > 0) {
        setCurrentGlucose(data[data.length - 1].value);
      }
    } catch (error) {
      console.error('Failed to fetch glucose readings:', error);
    } finally {
      if (showLoading) setIsInitialLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  const addReading = useCallback(async (value: number, type: GlucoseReading['measurementType'], linkedMealId?: string) => {
    setIsSubmitting(true);
    const readingData: Omit<GlucoseReading, 'id'> = {
      userId,
      timestamp: new Date(),
      value,
      measurementType: type,
      linkedMealId,
    };
    
    try {
      console.log('Attempting to save glucose reading to Firebase...', readingData);
      const docId = await saveGlucose(readingData);
      console.log('Successfully saved to Firebase with ID:', docId);
      await fetchReadings(false); // 배경에서 데이터 새로고침 (로딩 바 표시 없이)
      return true;
    } catch (error: any) {
      console.error('Detailed Error adding glucose reading:', error);
      // Firebase 에러 코드 확인용 로그
      if (error.code) console.error('Firebase Error Code:', error.code);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, fetchReadings]);

  const getChartData = useCallback((): GlucoseChartData[] => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    
    return readings
      .filter(r => r.timestamp >= cutoff)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(r => ({
        time: r.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        glucose: r.value,
        targetMin: 70,
        targetMax: 140,
      }));
  }, [readings]);

  const averageGlucose = readings.length > 0
    ? Math.round(readings.reduce((sum, r) => sum + r.value, 0) / readings.length)
    : 0;

  const inRangeCount = readings.filter(r => r.value >= 70 && r.value <= 140).length;
  const timeInRange = readings.length > 0
    ? Math.round((inRangeCount / readings.length) * 100)
    : 0;

  return {
    readings,
    loading: isInitialLoading, // 기존 호환성을 위해 loading 이름 유지
    isSubmitting,
    currentGlucose,
    averageGlucose,
    timeInRange,
    addReading,
    getChartData,
    fetchReadings,
  };
}
