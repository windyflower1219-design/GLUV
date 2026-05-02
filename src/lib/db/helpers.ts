/**
 * GLUV — DB helpers (서버 전용)
 *
 * - ensureUserExists: meals/glucose 저장 전 user_profiles에 행 보장 (FK 깨짐 방지)
 * - sumNutrients: parsedFoods 배열에서 합계 영양소 계산
 * - upsertFoodDictionary: 사용자별 음식 사전 학습
 * - recomputeMealImpact: 특정 식사의 혈당 영향 캐시 갱신
 * - scheduleImpactRecompute: 비동기 fire-and-forget 래퍼
 */

import sql from '@/lib/db/client';
import type { FoodItem } from '@/types';

/**
 * user_profiles 에 user_id 행이 없으면 빈 행을 만들어 둔다.
 * Firebase Auth에서 막 가입한 사용자가 첫 식사/혈당을 저장할 때 FK 위반을 방지.
 */
export async function ensureUserExists(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await sql`
      INSERT INTO user_profiles (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
    `;
  } catch (e) {
    // FK 미적용 환경(이전 마이그레이션 미실행)에서도 무해하게 통과
    console.warn('[ensureUserExists] ignored:', (e as any)?.message);
  }
}

export interface NutrientSum {
  carbs: number;
  calories: number;
  protein: number;
  fat: number;
  sodium: number;
}

export function sumNutrients(foods: Array<Partial<FoodItem>> | undefined | null): NutrientSum {
  const out: NutrientSum = { carbs: 0, calories: 0, protein: 0, fat: 0, sodium: 0 };
  if (!Array.isArray(foods)) return out;
  for (const f of foods) {
    out.carbs    += Number(f?.carbs    ?? 0) || 0;
    out.calories += Number(f?.calories ?? 0) || 0;
    out.protein  += Number(f?.protein  ?? 0) || 0;
    out.fat      += Number(f?.fat      ?? 0) || 0;
    out.sodium   += Number(f?.sodium   ?? 0) || 0;
  }
  return out;
}

/**
 * 사용자가 자주 먹는 음식의 평균값을 누적 학습.
 * 같은 음식 이름이 들어오면 use_count++, 평균값은 가중평균으로 갱신.
 */
export async function upsertFoodDictionary(
  userId: string,
  foods: Array<Partial<FoodItem>>
): Promise<void> {
  if (!userId || !Array.isArray(foods) || foods.length === 0) return;
  for (const f of foods) {
    const name = (f?.name || '').trim();
    if (!name) continue;
    const carbs    = Number(f.carbs    ?? 0) || 0;
    const protein  = Number(f.protein  ?? 0) || 0;
    const fat      = Number(f.fat      ?? 0) || 0;
    const calories = Number(f.calories ?? 0) || 0;
    const gi       = Number(f.glycemicIndex ?? 55) || 55;
    const qty      = Number(f.quantity ?? 1) || 1;
    const unit     = (f.unit || '인분').toString();

    try {
      await sql`
        INSERT INTO food_dictionary (
          user_id, food_name, default_quantity, default_unit,
          avg_carbs, avg_protein, avg_fat, avg_calories, gi,
          use_count, last_used_at
        )
        VALUES (
          ${userId}, ${name}, ${qty}, ${unit},
          ${carbs}, ${protein}, ${fat}, ${calories}, ${gi},
          1, NOW()
        )
        ON CONFLICT (user_id, food_name) DO UPDATE SET
          avg_carbs    = (food_dictionary.avg_carbs    * food_dictionary.use_count + ${carbs})    / (food_dictionary.use_count + 1),
          avg_protein  = (food_dictionary.avg_protein  * food_dictionary.use_count + ${protein})  / (food_dictionary.use_count + 1),
          avg_fat      = (food_dictionary.avg_fat      * food_dictionary.use_count + ${fat})      / (food_dictionary.use_count + 1),
          avg_calories = (food_dictionary.avg_calories * food_dictionary.use_count + ${calories}) / (food_dictionary.use_count + 1),
          gi           = (food_dictionary.gi           * food_dictionary.use_count + ${gi})       / (food_dictionary.use_count + 1),
          use_count    = food_dictionary.use_count + 1,
          last_used_at = NOW(),
          default_quantity = ${qty},
          default_unit     = ${unit}
      `;
    } catch (e) {
      // best-effort: 사전 누적 실패는 무시
      console.warn('[upsertFoodDictionary] skip', name, (e as any)?.message);
    }
  }
}

/**
 * 식사 시점 ±2시간 혈당으로 baseline / peak / Δ / 2h 후 값 계산.
 * 혈당 데이터가 부족하면 noop.
 */
export async function recomputeMealImpact(userId: string, mealId: string): Promise<void> {
  if (!userId || !mealId) return;
  try {
    const meal = await sql`SELECT timestamp FROM meals WHERE id = ${mealId} AND user_id = ${userId}`;
    if (meal.length === 0) return;
    const mealAt = new Date((meal[0] as any).timestamp);

    const before = new Date(mealAt.getTime() - 30 * 60_000);     // 식전 30분
    const after  = new Date(mealAt.getTime() + 150 * 60_000);    // 식후 2.5h

    const readings = await sql`
      SELECT timestamp, value FROM glucose_readings
      WHERE user_id = ${userId}
        AND timestamp BETWEEN ${before.toISOString()} AND ${after.toISOString()}
      ORDER BY timestamp ASC
    `;
    if (readings.length === 0) return;

    // baseline: 식사 시각 직전 값
    const pre = readings.filter((r: any) => new Date(r.timestamp) <= mealAt);
    const baseline = pre.length > 0 ? Number((pre[pre.length - 1] as any).value) : null;

    // post-meal 데이터
    const post = readings.filter((r: any) => new Date(r.timestamp) > mealAt);
    if (baseline === null || post.length === 0) return;

    let peakBg = -Infinity;
    let peakAtMin = 0;
    let bg2h: number | null = null;

    for (const r of post) {
      const v = Number((r as any).value);
      const minutes = Math.round((new Date((r as any).timestamp).getTime() - mealAt.getTime()) / 60_000);
      if (v > peakBg) { peakBg = v; peakAtMin = minutes; }
      // 2h 후 값: 90~150분 사이에서 가장 가까운 값
      if (minutes >= 90 && minutes <= 150) {
        if (bg2h === null || Math.abs(minutes - 120) < Math.abs((bg2h as any) - 120)) {
          bg2h = v;
        }
      }
    }

    const deltaBg = peakBg - baseline;
    const score = deltaBg < 30 ? 'green' : deltaBg < 60 ? 'yellow' : 'red';

    await sql`
      INSERT INTO meal_glucose_impacts (
        meal_id, user_id, baseline_bg, peak_bg, peak_at_min, delta_bg, bg_2h, glucotype_score, computed_at
      )
      VALUES (
        ${mealId}, ${userId}, ${baseline}, ${peakBg}, ${peakAtMin}, ${deltaBg}, ${bg2h}, ${score}, NOW()
      )
      ON CONFLICT (meal_id) DO UPDATE SET
        baseline_bg     = EXCLUDED.baseline_bg,
        peak_bg         = EXCLUDED.peak_bg,
        peak_at_min     = EXCLUDED.peak_at_min,
        delta_bg        = EXCLUDED.delta_bg,
        bg_2h           = EXCLUDED.bg_2h,
        glucotype_score = EXCLUDED.glucotype_score,
        computed_at     = NOW()
    `;
  } catch (e) {
    console.warn('[recomputeMealImpact] skip', mealId, (e as any)?.message);
  }
}

/** 응답 지연 없이 백그라운드로 영향 캐시 갱신 트리거 */
export function scheduleImpactRecompute(userId: string, mealId: string) {
  // Vercel/Edge가 아닌 Node 런타임에서 setImmediate 사용 가능. 폴백으로 setTimeout(0).
  const fn = () => recomputeMealImpact(userId, mealId).catch(() => {});
  if (typeof (globalThis as any).setImmediate === 'function') {
    (globalThis as any).setImmediate(fn);
  } else {
    setTimeout(fn, 0);
  }
}
