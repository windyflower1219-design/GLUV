'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GlucoseReading, WeeklyTrend, GlucoseChartData } from '@/types';

// 데모 데이터 생성 (Firebase 연동 전 테스트용)
function generateDemoReadings(): GlucoseReading[] {
  const readings: GlucoseReading[] = [];
  const now = new Date();

  const demoData = [
    { hoursAgo: 14, value: 95, type: 'fasting' as const },
    { hoursAgo: 12, value: 145, type: 'postmeal_1h' as const },
    { hoursAgo: 10, value: 118, type: 'postmeal_2h' as const },
    { hoursAgo: 6, value: 102, type: 'fasting' as const },
    { hoursAgo: 5, value: 168, type: 'postmeal_30m' as const },
    { hoursAgo: 4, value: 152, type: 'postmeal_1h' as const },
    { hoursAgo: 2, value: 125, type: 'postmeal_2h' as const },
    { hoursAgo: 0.5, value: 98, type: 'random' as const },
  ];

  demoData.forEach((d, i) => {
    const timestamp = new Date(now.getTime() - d.hoursAgo * 3600000);
    readings.push({
      id: `demo_${i}`,
      userId: 'demo_user',
      timestamp,
      value: d.value,
      measurementType: d.type,
    });
  });

  return readings;
}

export function useGlucoseData(userId?: string) {
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentGlucose, setCurrentGlucose] = useState<number>(0);

  useEffect(() => {
    // 데모 데이터 로드 (Firebase 연동 전)
    const timer = setTimeout(() => {
      const demoReadings = generateDemoReadings();
      setReadings(demoReadings);
      setCurrentGlucose(demoReadings[demoReadings.length - 1]?.value ?? 0);
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [userId]);

  const addReading = useCallback((value: number, type: GlucoseReading['measurementType'], linkedMealId?: string) => {
    const newReading: GlucoseReading = {
      id: `reading_${Date.now()}`,
      userId: userId ?? 'demo_user',
      timestamp: new Date(),
      value,
      measurementType: type,
      linkedMealId,
    };
    setReadings(prev => [...prev, newReading]);
    setCurrentGlucose(value);
    return newReading;
  }, [userId]);

  const getChartData = useCallback((): GlucoseChartData[] => {
    return readings
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
  };
}
