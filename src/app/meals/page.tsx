'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Mic, Camera, Trash2, ChevronDown, Search } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import VoiceInputModal from '@/components/VoiceInputModal';
import { predictGlucoseResponse } from '@/lib/algorithms/glucoseAnalysis';
import type { FoodItem, Meal, MealType } from '@/types';

const MEAL_TYPE_LABELS: Record<MealType, { label: string; emoji: string; color: string }> = {
  breakfast: { label: '아침', emoji: '🌅', color: 'text-orange-400' },
  lunch: { label: '점심', emoji: '☀️', color: 'text-yellow-400' },
  dinner: { label: '저녁', emoji: '🌙', color: 'text-blue-400' },
  snack: { label: '간식', emoji: '🍎', color: 'text-purple-400' },
};

function getMealType(): MealType {
  const h = new Date().getHours();
  if (h >= 6 && h < 10) return 'breakfast';
  if (h >= 10 && h < 15) return 'lunch';
  if (h >= 15 && h < 19) return 'dinner';
  return 'snack';
}

const DEMO_MEALS: Meal[] = [
  {
    id: '1',
    userId: 'demo',
    timestamp: new Date(Date.now() - 2 * 3600000),
    mealType: 'lunch',
    rawVoiceInput: '점심에 제육볶음이랑 밥 먹었어',
    parsedFoods: [
      { id: 'f1', name: '제육볶음', quantity: 1, unit: '인분', carbs: 20, calories: 350, glycemicIndex: 55, protein: 25, fat: 18, sodium: 900 },
      { id: 'f2', name: '밥', quantity: 1, unit: '공기', carbs: 65, calories: 300, glycemicIndex: 72, protein: 5, fat: 1, sodium: 5 },
    ],
    totalCarbs: 85,
    totalCalories: 650,
    glucotypeScore: 'yellow',
  },
  {
    id: '2',
    userId: 'demo',
    timestamp: new Date(Date.now() - 6 * 3600000),
    mealType: 'breakfast',
    rawVoiceInput: '아침에 현미밥이랑 된장찌개 먹었어',
    parsedFoods: [
      { id: 'f3', name: '현미밥', quantity: 1, unit: '공기', carbs: 58, calories: 280, glycemicIndex: 55, protein: 6, fat: 2, sodium: 3 },
      { id: 'f4', name: '된장찌개', quantity: 1, unit: '인분', carbs: 12, calories: 120, glycemicIndex: 40, protein: 8, fat: 5, sodium: 1000 },
    ],
    totalCarbs: 70,
    totalCalories: 400,
    glucotypeScore: 'green',
  },
];

export default function MealsPage() {
  const [meals, setMeals] = useState<Meal[]>(DEMO_MEALS);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate] = useState(new Date());
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);

  const handleConfirm = useCallback((foods: Partial<FoodItem>[], rawText: string) => {
    const fullFoods = foods as FoodItem[];
    const prediction = predictGlucoseResponse(fullFoods, 100);
    const newMeal: Meal = {
      id: Date.now().toString(),
      userId: 'demo',
      timestamp: new Date(),
      mealType: getMealType(),
      rawVoiceInput: rawText,
      parsedFoods: fullFoods,
      totalCarbs: fullFoods.reduce((s, f) => s + f.carbs * f.quantity, 0),
      totalCalories: fullFoods.reduce((s, f) => s + f.calories * f.quantity, 0),
      glucotypeScore: prediction.riskLevel,
    };
    setMeals(prev => [newMeal, ...prev]);
  }, []);

  const groupedMeals = meals.reduce<Record<MealType, Meal[]>>((acc, meal) => {
    if (!acc[meal.mealType]) acc[meal.mealType] = [];
    acc[meal.mealType].push(meal);
    return acc;
  }, {} as Record<MealType, Meal[]>);

  const todayCalories = meals.reduce((s, m) => s + m.totalCalories, 0);
  const todayCarbs = meals.reduce((s, m) => s + m.totalCarbs, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 page-content">
      {/* 헤더 */}
      <header className="safe-top px-5 pt-4 pb-3 sticky top-0 bg-gray-950/90 backdrop-blur z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-white">식단 기록</h1>
          <button className="w-9 h-9 rounded-full glass-card flex items-center justify-center">
            <Search size={16} className="text-slate-400" />
          </button>
        </div>
        {/* 날짜 선택 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[-2, -1, 0, 1, 2].map(offset => {
            const d = new Date();
            d.setDate(d.getDate() + offset);
            const isToday = offset === 0;
            return (
              <div key={offset}
                className={`flex flex-col items-center px-3 py-2 rounded-xl min-w-[52px] cursor-pointer transition-all ${
                  isToday ? 'bg-blue-500 text-white' : 'glass-card text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-[10px] font-medium">
                  {d.toLocaleDateString('ko-KR', { weekday: 'short' })}
                </span>
                <span className={`text-lg font-bold ${isToday ? 'text-white' : ''}`}>
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </header>

      <div className="px-4 space-y-4">
        {/* 오늘 요약 */}
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 mb-3">오늘 섭취 현황</p>
          <div className="flex justify-around">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-400">{todayCalories}</p>
              <p className="text-xs text-slate-500">칼로리 (kcal)</p>
            </div>
            <div className="w-px bg-white/5" />
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">{todayCarbs}g</p>
              <p className="text-xs text-slate-500">탄수화물</p>
            </div>
            <div className="w-px bg-white/5" />
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{meals.length}</p>
              <p className="text-xs text-slate-500">식사 횟수</p>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-yellow-400"
              style={{ width: `${Math.min(100, (todayCalories / 2000) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-right text-slate-500 mt-1">{todayCalories} / 2000 kcal</p>
        </div>

        {/* 입력 방법 버튼들 */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: <Mic size={20} />, label: '음성', color: 'from-blue-500 to-purple-600', action: () => setShowModal(true) },
            { icon: <Camera size={20} />, label: '사진', color: 'from-teal-500 to-cyan-500', action: () => {} },
            { icon: <Plus size={20} />, label: '직접입력', color: 'from-slate-600 to-slate-700', action: () => setShowModal(true) },
          ].map(({ icon, label, color, action }) => (
            <button
              key={label}
              onClick={action}
              className={`p-3 rounded-xl bg-gradient-to-br ${color} flex flex-col items-center gap-1.5 active:scale-95 transition-all`}
            >
              <div className="text-white">{icon}</div>
              <span className="text-xs text-white font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* 식사별 목록 */}
        {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(type => {
          const typeMeals = groupedMeals[type] || [];
          const config = MEAL_TYPE_LABELS[type];
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{config.emoji}</span>
                <h2 className={`font-semibold text-sm ${config.color}`}>{config.label}</h2>
                {typeMeals.length > 0 && (
                  <span className="text-xs text-slate-600">
                    {typeMeals.reduce((s, m) => s + m.totalCalories, 0)}kcal
                  </span>
                )}
              </div>

              {typeMeals.length === 0 ? (
                <div
                  onClick={() => setShowModal(true)}
                  className="glass-card p-3 flex items-center gap-3 border-dashed opacity-40 active:opacity-60 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center">
                    <Plus size={14} className="text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-500">{config.label} 기록 추가</p>
                </div>
              ) : (
                typeMeals.map(meal => (
                  <div key={meal.id} className="glass-card mb-2 overflow-hidden">
                    <div
                      className="p-3 flex items-center gap-3 cursor-pointer"
                      onClick={() => setExpandedMealId(expandedMealId === meal.id ? null : meal.id)}
                    >
                      <div className={`w-1.5 h-12 rounded-full ${
                        meal.glucotypeScore === 'green' ? 'bg-emerald-500' :
                        meal.glucotypeScore === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                          {meal.parsedFoods.map(f => f.name).join(', ')}
                        </p>
                        <p className="text-xs text-slate-400">
                          {meal.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} · {meal.totalCalories}kcal · 탄수 {meal.totalCarbs}g
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          meal.glucotypeScore === 'green' ? 'glucotype-green' :
                          meal.glucotypeScore === 'yellow' ? 'glucotype-yellow' : 'glucotype-red'
                        }`}>
                          {meal.glucotypeScore === 'green' ? '안전' : meal.glucotypeScore === 'yellow' ? '주의' : '위험'}
                        </span>
                        <ChevronDown
                          size={14}
                          className={`text-slate-500 transition-transform ${expandedMealId === meal.id ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>

                    {/* 확장된 상세 정보 */}
                    {expandedMealId === meal.id && (
                      <div className="px-3 pb-3 border-t border-white/5 pt-3 animate-fade-in">
                        <p className="text-xs text-slate-500 mb-2">음성 입력: "{meal.rawVoiceInput}"</p>
                        <div className="space-y-1.5">
                          {meal.parsedFoods.map(f => (
                            <div key={f.id} className="flex items-center justify-between text-xs">
                              <span className="text-slate-300">{f.name} ({f.quantity}{f.unit})</span>
                              <span className="text-slate-500">{f.calories}kcal / 탄수 {f.carbs}g / GI {f.glycemicIndex}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => setMeals(prev => prev.filter(m => m.id !== meal.id))}
                          className="mt-3 flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={12} /> 삭제
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* 플로팅 추가 버튼 */}
      <button
        onClick={() => setShowModal(true)}
        className="fab-mic"
        aria-label="식사 기록 추가"
      >
        <Mic size={26} className="text-white" />
      </button>

      {showModal && (
        <VoiceInputModal onClose={() => setShowModal(false)} onConfirm={handleConfirm} />
      )}

      <BottomNavigation />
    </div>
  );
}
