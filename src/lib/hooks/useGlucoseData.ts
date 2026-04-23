'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  saveGlucose,
  getGlucoseReadings,
  updateGlucose,
  deleteGlucose,
} from '@/lib/firebase/firestore';
import type { GlucoseReading, GlucoseChartData } from '@/types';
import { useAuth } from '@/context/AuthContext';

import { useHealthData } from '@/context/HealthDataContext';

export function useGlucoseData() {
  const { user } = useAuth();
  const userId = user?.uid || 'guest';
  const { glucoseReadings: globalReadings, isLoading: globalLoading, refreshData } = useHealthData();
  
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentGlucose, setCurrentGlucose] = useState<number>(0);

  // 컨텍스트 데이터와 로컬 상태 동기화
  useEffect(() => {
    if (globalReadings.length > 0) {
      setReadings(globalReadings);
      setCurrentGlucose(globalReadings[globalReadings.length - 1].value);
    }
    setIsInitialLoading(globalLoading);
  }, [globalReadings, globalLoading]);

  const fetchReadings = useCallback(async (showLoading = true) => {
    // 이미 globalLoading이 처리 중이면 중복 호출 방지 또는 배경 업데이트
    await refreshData();
  }, [refreshData]);

  const addReading = useCallback(async (value: number, type: GlucoseReading['measurementType'], timestamp: Date = new Date(), linkedMealId?: string) => {
    setIsSubmitting(true);
    const readingData: Omit<GlucoseReading, 'id'> = {
      userId,
      timestamp,
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

  const editReading = useCallback(async (
    id: string,
    updates: Partial<Omit<GlucoseReading, 'id'>>,
  ) => {
    // Optimistic update: 로컬 state를 먼저 업데이트해 UI는 즉시 반영
    let prevSnapshot: GlucoseReading[] = [];
    setReadings((prev) => {
      prevSnapshot = prev;
      return prev
        .map((r) => (r.id === id ? { ...r, ...updates } as GlucoseReading : r))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    });

    setIsSubmitting(true);
    try {
      await updateGlucose(id, updates);
      return true;
    } catch (error) {
      console.error('Failed to update glucose reading, reverting:', error);
      setReadings(prevSnapshot); // 롤백
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const removeReading = useCallback(async (id: string) => {
    // Optimistic update: 삭제를 즉시 반영
    let prevSnapshot: GlucoseReading[] = [];
    setReadings((prev) => {
      prevSnapshot = prev;
      return prev.filter((r) => r.id !== id);
    });

    setIsSubmitting(true);
    try {
      await deleteGlucose(id);
      return true;
    } catch (error) {
      console.error('Failed to delete glucose reading, reverting:', error);
      setReadings(prevSnapshot); // 롤백
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

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
    editReading,
    removeReading,
    getChartData,
    fetchReadings,
  };
}
