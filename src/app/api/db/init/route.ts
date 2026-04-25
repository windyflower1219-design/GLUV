import { NextResponse } from 'next/server';
import sql from '@/lib/db/client';

export async function POST() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id        TEXT PRIMARY KEY,
        target_kcal    INTEGER NOT NULL DEFAULT 2000,
        target_glucose_min INTEGER NOT NULL DEFAULT 70,
        target_glucose_max INTEGER NOT NULL DEFAULT 140,
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS meals (
        id               TEXT PRIMARY KEY,
        user_id          TEXT NOT NULL,
        timestamp        TIMESTAMPTZ NOT NULL,
        meal_type        TEXT NOT NULL,
        raw_voice_input  TEXT NOT NULL DEFAULT '',
        parsed_foods     JSONB NOT NULL DEFAULT '[]',
        total_carbs      NUMERIC NOT NULL DEFAULT 0,
        total_calories   NUMERIC NOT NULL DEFAULT 0,
        glucotype_score  TEXT NOT NULL DEFAULT 'green',
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_meals_user_ts
        ON meals (user_id, timestamp DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS glucose_readings (
        id               TEXT PRIMARY KEY,
        user_id          TEXT NOT NULL,
        timestamp        TIMESTAMPTZ NOT NULL,
        value            INTEGER NOT NULL,
        measurement_type TEXT NOT NULL,
        linked_meal_id   TEXT,
        notes            TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_glucose_user_ts
        ON glucose_readings (user_id, timestamp DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS parse_corrections (
        id               TEXT PRIMARY KEY,
        user_id          TEXT,
        timestamp        TIMESTAMPTZ NOT NULL,
        raw_voice_input  TEXT NOT NULL,
        parsed_names     TEXT[] NOT NULL DEFAULT '{}',
        corrected_names  TEXT[] NOT NULL DEFAULT '{}',
        confidence       NUMERIC NOT NULL DEFAULT 0,
        correction_type  TEXT NOT NULL,
        source           TEXT,
        model_used       TEXT,
        recovery         BOOLEAN
      )
    `;

    return NextResponse.json({ ok: true, message: '테이블 생성 완료' });
  } catch (error: any) {
    console.error('[db/init] error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
