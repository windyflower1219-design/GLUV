'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getMeals, getGlucoseReadings, getUserProfile, UserProfile } from '@/lib/firebase/firestore';
import type { Meal, GlucoseReading } from '@/types';

interface HealthDataContextType {
  meals: Meal[];            // 오늘(또는 refreshData에 전달한 날짜)의 식단
  recentMeals: Meal[];      // 최근 30일 식단 (히스토리 분석용)
  glucoseReadings: GlucoseReading[];
  userProfile: UserProfile | null;
  isLoading: boolean;
  refreshData: (date?: Date) => Promise<void>;
  lastUpdated: number;
}

const HealthDataContext = createContext<HealthDataContextType>({
  meals: [],
  recentMeals: [],
  glucoseReadings: [],
  userProfile: null,
  isLoading: true,
  refreshData: async () => {},
  lastUpdated: 0,
});

export const useHealthData = () => useContext(HealthDataContext);

export const HealthDataProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.uid;

  const [meals, setMeals] = useState<Meal[]>([]);
  const [recentMeals, setRecentMeals] = useState<Meal[]>([]);
  const [glucoseReadings, setGlucoseReadings] = useState<GlucoseReading[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(0);

  const refreshData = useCallback(async (date?: Date) => {
    if (!userId) return;

    const targetDate = date || new Date();

    try {
      const [todayMeals, glucoseData, profileData, historyMeals] = await Promise.all([
        getMeals(userId, targetDate),       // 특정 날짜 식단 (기본: 오늘)
        getGlucoseReadings(userId, 168),    // 최근 7일 혈당
        getUserProfile(userId),
        getMeals(userId),                   // 최근 30일 식단 (히스토리)
      ]);

      setMeals(todayMeals);
      setRecentMeals(historyMeals);
      setGlucoseReadings(glucoseData);
      setUserProfile(profileData);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error('Failed to refresh health data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // userId 확인되면 초기 로딩
  useEffect(() => {
    if (userId) {
      refreshData();
    }
  }, [userId, refreshData]);

  return (
    <HealthDataContext.Provider
      value={{
        meals,
        recentMeals,
        glucoseReadings,
        userProfile,
        isLoading,
        refreshData,
        lastUpdated,
      }}
    >
      {children}
    </HealthDataContext.Provider>
  );
};
