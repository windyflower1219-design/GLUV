'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getMeals, getGlucoseReadings, getUserProfile, UserProfile } from '@/lib/firebase/firestore';
import type { Meal, GlucoseReading } from '@/types';

interface HealthDataContextType {
  meals: Meal[];
  glucoseReadings: GlucoseReading[];
  userProfile: UserProfile | null;
  isLoading: boolean;
  refreshData: (date?: Date) => Promise<void>;
  lastUpdated: number;
}

const HealthDataContext = createContext<HealthDataContextType>({
  meals: [],
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
  const [glucoseReadings, setGlucoseReadings] = useState<GlucoseReading[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(0);

  const refreshData = useCallback(async (date?: Date) => {
    if (!userId) return;
    
    // date가 없으면 오늘 날짜 기준
    const targetDate = date || new Date();
    
    try {
      const [mealsData, glucoseData, profileData] = await Promise.all([
        getMeals(userId, targetDate),
        getGlucoseReadings(userId, 48),
        getUserProfile(userId),
      ]);

      setMeals(mealsData);
      setGlucoseReadings(glucoseData);
      setUserProfile(profileData);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error('Failed to refresh health data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // 초기 로딩 (userId가 확인되면 호출)
  useEffect(() => {
    if (userId) {
      refreshData();
    }
  }, [userId, refreshData]);

  // 전역 'record-saved' 이벤트 구독
  useEffect(() => {
    const handleRefresh = () => refreshData();
    window.addEventListener('record-saved', handleRefresh);
    return () => window.removeEventListener('record-saved', handleRefresh);
  }, [refreshData]);

  return (
    <HealthDataContext.Provider value={{
      meals,
      glucoseReadings,
      userProfile,
      isLoading,
      refreshData,
      lastUpdated
    }}>
      {children}
    </HealthDataContext.Provider>
  );
};
