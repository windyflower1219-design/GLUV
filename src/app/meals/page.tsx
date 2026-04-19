'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Plus, Camera, Trash2, ChevronDown,
  Search, MicIcon, Loader2, Pencil, Check, X
} from '@/components/common/Icons';
import PageHeader from '@/components/common/PageHeader';
import { predictGlucoseResponse } from '@/lib/algorithms/glucoseAnalysis';
import { saveMeal, getMeals, deleteMeal, updateMeal, saveGlucose } from '@/lib/firebase/firestore';
import { useVoiceInputContext } from '@/context/VoiceInputContext';
import { useUnifiedStorage } from '@/lib/hooks/useUnifiedStorage';
import type { FoodItem, Meal, MealType, MeasurementType } from '@/types';
import { useAuth } from '@/context/AuthContext';

const MEAL_TYPE_LABELS: Record<MealType, { label: string; emoji: string; color: string; bg: string }> = {
  breakfast: { label: '아침', emoji: '🌅', color: 'text-orange-500', bg: 'bg-orange-50' },
  lunch: { label: '점심', emoji: '☀️', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  dinner: { label: '저녁', emoji: '🌙', color: 'text-indigo-500', bg: 'bg-indigo-50' },
  snack: { label: '간식', emoji: '🍎', color: 'text-rose-500', bg: 'bg-rose-50' },
};

function getMealType(): MealType {
  const h = new Date().getHours();
  if (h >= 6 && h < 10) return 'breakfast';
  if (h >= 10 && h < 15) return 'lunch';
  if (h >= 15 && h < 19) return 'dinner';
  return 'snack';
}

export default function MealsPage() {
  const { user } = useAuth();
  const userId = user?.uid || 'guest';
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  
  const { openVoiceInput, isSubmitting, setIsSubmitting } = useVoiceInputContext();
  const { saveUnifiedRecord } = useUnifiedStorage();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<FoodItem[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const startEditing = (meal: Meal) => {
    // 깊은 복사를 해야 원본을 건드리지 않음
    setEditDraft(meal.parsedFoods.map(f => ({ ...f })));
    setEditingId(meal.id);
    setDeletingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDraft([]);
  };

  const updateDraftField = (idx: number, field: keyof FoodItem, value: string) => {
    setEditDraft(prev => {
      const next = [...prev];
      const numericFields: (keyof FoodItem)[] = ['quantity', 'carbs', 'calories', 'glycemicIndex', 'protein', 'fat', 'sodium'];
      const parsed: any = numericFields.includes(field)
        ? (value === '' ? 0 : Number(value))
        : value;
      next[idx] = { ...next[idx], [field]: parsed };
      return next;
    });
  };

  const saveEdit = async (meal: Meal) => {
    setIsSavingEdit(true);
    try {
      const foods = editDraft;
      const totalCarbs = foods.reduce((s, f) => s + (Number(f.carbs) || 0) * (Number(f.quantity) || 1), 0);
      const totalCalories = foods.reduce((s, f) => s + (Number(f.calories) || 0) * (Number(f.quantity) || 1), 0);
      const prediction = predictGlucoseResponse(foods, 100);
      await updateMeal(meal.id, {
        parsedFoods: foods,
        totalCarbs,
        totalCalories,
        glucotypeScore: prediction.riskLevel,
      });
      await fetchMeals(false);
      setEditingId(null);
      setEditDraft([]);
      window.dispatchEvent(new CustomEvent('record-saved'));
    } catch (err: any) {
      alert(`수정에 실패했습니다: ${err?.message || err}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const fetchMeals = useCallback(async (showLoading = true) => {
    if (showLoading) setIsInitialLoading(true);
    try {
      const data = await getMeals(userId, selectedDate);
      setMeals(data);
    } catch (error) {
      console.error('Failed to fetch meals:', error);
    } finally {
      if (showLoading) setIsInitialLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchMeals();
    
    // 전역 저장 이벤트 리스너
    const handleRefresh = () => fetchMeals(false);
    window.addEventListener('record-saved', handleRefresh);
    return () => window.removeEventListener('record-saved', handleRefresh);
  }, [fetchMeals]);

  const handleDelete = async (id: string) => {
    await deleteMeal(id);
    setDeletingId(null);
    fetchMeals();
  };

  const groupedMeals = meals.reduce<Record<MealType, Meal[]>>((acc, meal) => {
    if (!acc[meal.mealType]) acc[meal.mealType] = [];
    acc[meal.mealType].push(meal);
    return acc;
  }, {} as Record<MealType, Meal[]>);

  const todayCalories = meals.reduce((s, m) => s + m.totalCalories, 0);
  const todayCarbs = meals.reduce((s, m) => s + m.totalCarbs, 0);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] page-content">
      <PageHeader 
        title="식단 기록" 
        rightElement={
          <button className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-[var(--color-border)]">
            <Search size={18} className="text-[var(--color-text-secondary)]" />
          </button>
        }
      />
      
      {/* 날짜 선택 섹션 (헤더 바로 아래 유지) */}
      <div className="px-5 py-3 sticky top-[72px] bg-[var(--color-bg-primary)]/90 backdrop-blur z-10 border-b border-[var(--color-border)]">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[-3, -2, -1, 0, 1, 2, 3].map(offset => {
            const d = new Date();
            d.setDate(d.getDate() + offset);
            const isSelected = selectedDate.toDateString() === d.toDateString();
            const isToday = new Date().toDateString() === d.toDateString();
            
            return (
              <div key={offset}
                onClick={() => setSelectedDate(d)}
                className={`flex flex-col items-center px-3 py-2 rounded-2xl min-w-[56px] cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-[var(--color-accent-pink)] text-white shadow-lg scale-105' 
                    : 'bg-white text-[var(--color-text-secondary)] border border-[var(--color-border)]'
                }`}
              >
                <span className="text-[10px] font-bold opacity-80">
                  {d.toLocaleDateString('ko-KR', { weekday: 'short' })}
                </span>
                <span className="text-lg font-extrabold">
                  {d.getDate()}
                </span>
                {isToday && !isSelected && <div className="w-1 h-1 rounded-full bg-[var(--color-accent-pink)] mt-0.5" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 space-y-5 pt-4">
        {/* 오늘 요약 */}
        <div className="glass-card p-5 border-none shadow-sm relative overflow-hidden bg-white/50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--color-accent-pink)] opacity-5 rounded-full -mr-8 -mt-8" />
          <p className="text-xs font-bold text-[var(--color-text-secondary)] mb-4 flex items-center gap-1">
            <span className="w-1 h-3 bg-[var(--color-accent-pink)] rounded-full mr-1" />
            오늘의 영양 소식
          </p>
          <div className="flex justify-around items-end">
            <div className="text-center">
              <p className="text-2xl font-black text-[var(--color-danger)]">{todayCalories}</p>
              <p className="text-[10px] font-bold text-[var(--color-text-secondary)]">칼로리 (kcal)</p>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="text-center">
              <p className="text-2xl font-black text-[var(--color-warning)]">{todayCarbs}g</p>
              <p className="text-[10px] font-bold text-[var(--color-text-secondary)]">탄수화물</p>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="text-center">
              <p className="text-2xl font-black text-[var(--color-success)]">{meals.length}</p>
              <p className="text-[10px] font-bold text-[var(--color-text-secondary)]">식사 횟수</p>
            </div>
          </div>
          <div className="mt-5 h-3 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent-pink)] to-[var(--color-warning)] transition-all duration-500"
              style={{ width: `${Math.min(100, (todayCalories / 2000) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">목표 2000 kcal</span>
            <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">남음 {Math.max(0, 2000 - todayCalories)} kcal</span>
          </div>
        </div>

        {/* 입력 방법 버튼들 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <MicIcon size={22} />, label: '말하기', color: 'bg-blue-50 text-blue-500 border-blue-100', action: openVoiceInput },
            { icon: <Camera size={22} />, label: '사진찍기', color: 'bg-emerald-50 text-emerald-500 border-emerald-100', action: () => {} },
            { icon: <Plus size={22} />, label: '직접쓰기', color: 'bg-slate-50 text-slate-500 border-slate-100', action: openVoiceInput },
          ].map(({ icon, label, color, action }) => (
            <button
              key={label}
              onClick={action}
              className={`p-4 rounded-3xl ${color} border flex flex-col items-center gap-2 active:scale-95 transition-all shadow-sm`}
            >
              <div className="p-2 rounded-2xl bg-white shadow-sm">{icon}</div>
              <span className="text-xs font-bold">{label}</span>
            </button>
          ))}
        </div>

        {/* 식사별 목록 */}
        <div className="space-y-6 pb-4">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(type => {
            const typeMeals = groupedMeals[type] || [];
            const config = MEAL_TYPE_LABELS[type];
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-xl ${config.bg} flex items-center justify-center text-lg shadow-sm border border-white`}>
                      {config.emoji}
                    </span>
                    <h2 className={`font-black text-sm text-[var(--color-text-primary)]`}>{config.label}</h2>
                  </div>
                  {typeMeals.length > 0 && (
                    <span className="text-[10px] font-bold text-[var(--color-text-secondary)] bg-white px-2 py-1 rounded-lg border border-[var(--color-border)]">
                      {typeMeals.reduce((s, m) => s + m.totalCalories, 0)} kcal
                    </span>
                  )}
                </div>

                {isInitialLoading ? (
                  <div className="h-20 skeleton rounded-3xl" />
                ) : typeMeals.length === 0 ? (
                  <div
                    onClick={openVoiceInput}
                    className="bg-white/40 border-2 border-dashed border-gray-200 p-4 rounded-3xl flex items-center justify-center gap-2 active:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus size={14} className="text-gray-400" />
                    </div>
                    <p className="text-xs font-bold text-gray-400">{config.label} 식사를 기록해보세요</p>
                  </div>
                ) : (
                  typeMeals.map(meal => (
                    <div key={meal.id} className="bg-white rounded-3xl p-4 shadow-sm border border-[var(--color-border)] mb-3 overflow-hidden">
                      <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => setExpandedMealId(expandedMealId === meal.id ? null : meal.id)}
                      >
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${
                          meal.glucotypeScore === 'green' ? 'bg-emerald-50 text-emerald-500' :
                          meal.glucotypeScore === 'yellow' ? 'bg-yellow-50 text-yellow-600' : 'bg-rose-50 text-rose-500'
                        }`}>
                          <span className="text-xs font-black">
                            {meal.glucotypeScore === 'green' ? '👍' : meal.glucotypeScore === 'yellow' ? '🤏' : '⚠️'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-[var(--color-text-primary)] truncate">
                            {meal.parsedFoods.map(f => f.name).join(', ')}
                          </p>
                          <p className="text-[10px] font-bold text-[var(--color-text-secondary)] mt-0.5">
                            {meal.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} · {meal.totalCalories} kcal
                          </p>
                        </div>
                        <ChevronDown
                          size={16}
                          className={`text-gray-300 transition-transform duration-300 ${expandedMealId === meal.id ? 'rotate-180' : ''}`}
                        />
                      </div>

                      {expandedMealId === meal.id && (
                        <div className="mt-4 pt-4 border-t border-gray-50 flex flex-col gap-3 animate-fade-in">
                          <div className="p-3 bg-gray-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-gray-400 mb-1 italic">반응 확인:</p>
                            <p className="text-xs font-bold text-gray-600 leading-relaxed">"{meal.rawVoiceInput}"</p>
                          </div>

                          {editingId === meal.id ? (
                            // 수정 모드
                            <div className="space-y-2">
                              {editDraft.map((f, i) => (
                                <div key={i} className="p-3 rounded-2xl border border-indigo-100 bg-indigo-50/30 space-y-2">
                                  <input
                                    type="text"
                                    value={f.name}
                                    onChange={(e) => updateDraftField(i, 'name', e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 text-xs font-black text-gray-700 outline-none focus:border-indigo-300"
                                    placeholder="음식 이름"
                                  />
                                  <div className="grid grid-cols-4 gap-2">
                                    <label className="flex flex-col gap-1">
                                      <span className="text-[9px] font-black text-gray-400">수량</span>
                                      <input
                                        type="number"
                                        value={f.quantity}
                                        onChange={(e) => updateDraftField(i, 'quantity', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-[11px] font-bold text-gray-700 outline-none focus:border-indigo-300"
                                        min={0}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="text-[9px] font-black text-gray-400">단위</span>
                                      <input
                                        type="text"
                                        value={f.unit}
                                        onChange={(e) => updateDraftField(i, 'unit', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-[11px] font-bold text-gray-700 outline-none focus:border-indigo-300"
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="text-[9px] font-black text-gray-400">kcal</span>
                                      <input
                                        type="number"
                                        value={f.calories}
                                        onChange={(e) => updateDraftField(i, 'calories', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-[11px] font-bold text-gray-700 outline-none focus:border-indigo-300"
                                        min={0}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="text-[9px] font-black text-gray-400">탄수(g)</span>
                                      <input
                                        type="number"
                                        value={f.carbs}
                                        onChange={(e) => updateDraftField(i, 'carbs', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-[11px] font-bold text-gray-700 outline-none focus:border-indigo-300"
                                        min={0}
                                      />
                                    </label>
                                  </div>
                                </div>
                              ))}

                              <div className="flex gap-2 justify-end pt-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); cancelEditing(); }}
                                  disabled={isSavingEdit}
                                  className="flex items-center gap-1 text-[11px] font-black text-gray-500 bg-gray-100 px-3 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                                >
                                  <X size={12} /> 취소
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); saveEdit(meal); }}
                                  disabled={isSavingEdit}
                                  className="flex items-center gap-1 text-[11px] font-black text-white bg-indigo-500 px-3 py-2 rounded-xl active:scale-95 transition-all shadow-sm shadow-indigo-100 disabled:opacity-50"
                                >
                                  {isSavingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                  저장
                                </button>
                              </div>
                            </div>
                          ) : (
                            // 보기 모드
                            <div className="space-y-2">
                              {meal.parsedFoods.map((f, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-xl border border-gray-50">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-700">{f.name}</span>
                                    <span className="text-[10px] text-gray-400">{f.quantity}{f.unit}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-black text-gray-500">{f.calories} kcal</span>
                                    <br/>
                                    <span className="text-[9px] font-bold text-gray-400">탄수 {f.carbs}g</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 액션 버튼들 */}
                          {editingId !== meal.id && (
                            deletingId === meal.id ? (
                              <div className="self-end flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-2xl px-3 py-2 animate-fade-in">
                                <p className="text-xs font-bold text-rose-500">정말 삭제할까요?</p>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(meal.id); }}
                                  className="text-[10px] font-black text-white bg-rose-400 px-3 py-1.5 rounded-xl active:scale-95 transition-all"
                                >
                                  삭제
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                                  className="text-[10px] font-black text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl active:scale-95 transition-all"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <div className="self-end flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); startEditing(meal); }}
                                  className="p-2 text-indigo-300 hover:text-indigo-500 transition-colors"
                                  aria-label="수정"
                                  title="수정"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingId(meal.id);
                                  }}
                                  className="p-2 text-rose-300 hover:text-rose-500 transition-colors"
                                  aria-label="삭제"
                                  title="삭제"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
