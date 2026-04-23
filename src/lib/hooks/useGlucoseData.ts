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

  const getChartData = useCallback((period: 'day' | 'week' | 'month' = 'day'): GlucoseChartData[] => {
    const now = new Date();
    const cutoff = new Date();
    
    if (period === 'day') cutoff.setHours(0, 0, 0, 0);
    else if (period === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // 월요일 기준
      cutoff.setDate(diff);
      cutoff.setHours(0, 0, 0, 0);
    } else {
      cutoff.setDate(1);
      cutoff.setHours(0, 0, 0, 0);
    }

    const filtered = readings
      .filter(r => r.timestamp >= cutoff)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (period === 'day') {
      return filtered.map(r => ({
        time: r.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        glucose: r.value,
        targetMin: 70,
        targetMax: 140,
      }));
    }

    // 주간/월간의 경우 일별 평균값으로 그룹화
    const groupedData: Record<string, { total: number; count: number; date: Date }> = {};
    
    filtered.forEach(r => {
      const dateKey = r.timestamp.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
      if (!groupedData[dateKey]) {
        groupedData[dateKey] = { total: 0, count: 0, date: r.timestamp };
      }
      groupedData[dateKey].total += r.value;
      groupedData[dateKey].count += 1;
    });

    return Object.entries(groupedData).map(([time, data]) => ({
      time,
      glucose: Math.round(data.total / data.count),
      targetMin: 70,
      targetMax: 140,
    }));
  }, [readings]);

  const getStatsByPeriod = useCallback((period: 'day' | 'week' | 'month' = 'day') => {
    const now = new Date();
    const cutoff = new Date();
    
    if (period === 'day') cutoff.setHours(0, 0, 0, 0);
    else if (period === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      cutoff.setDate(diff);
      cutoff.setHours(0, 0, 0, 0);
    } else {
      cutoff.setDate(1);
      cutoff.setHours(0, 0, 0, 0);
    }

    const filtered = readings.filter(r => r.timestamp >= cutoff);
    
    if (filtered.length === 0) return { avg: 0, max: 0, min: 0, count: 0 };

    const values = filtered.map(r => r.value);
    return {
      avg: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
      max: Math.max(...values),
      min: Math.min(...values),
      count: filtered.length
    };
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
    loading: isInitialLoading,
    isSubmitting,
    currentGlucose,
    averageGlucose,
    timeInRange,
    addReading,
    editReading,
    removeReading,
    getChartData,
    getStatsByPeriod,
    fetchReadings,
  };
}
