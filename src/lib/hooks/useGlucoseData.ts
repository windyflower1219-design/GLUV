'use client';

import { useState, useEffect, useCallback } from 'react';
import { saveGlucose, getGlucoseReadings } from '@/lib/firebase/firestore';
import type { GlucoseReading, GlucoseChartData } from '@/types';

export function useGlucoseData(userId: string = 'demo') {
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentGlucose, setCurrentGlucose] = useState<number>(0);

  const fetchReadings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGlucoseReadings(userId, 72); // 최신 72시간 데이터 로드
      setReadings(data);
      if (data.length > 0) {
        setCurrentGlucose(data[data.length - 1].value);
      }
    } catch (error) {
      console.error('Failed to fetch glucose readings:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  const addReading = useCallback(async (value: number, type: GlucoseReading['measurementType'], linkedMealId?: string) => {
    const readingData: Omit<GlucoseReading, 'id'> = {
      userId,
      timestamp: new Date(),
      value,
      measurementType: type,
      linkedMealId,
    };
    
    try {
      await saveGlucose(readingData);
      await fetchReadings(); // 데이터 새로고침
      return true;
    } catch (error) {
      console.error('Error adding glucose reading:', error);
      throw error;
    }
  }, [userId, fetchReadings]);

  const getChartData = useCallback((): GlucoseChartData[] => {
    // 최근 24시간 데이터만 차트에 표시
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
    loading,
    currentGlucose,
    averageGlucose,
    timeInRange,
    addReading,
    getChartData,
    fetchReadings,
  };
}
