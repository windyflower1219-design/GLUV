/**
 * GLUV — DB 마이그레이션 (Neon Postgres)
 *
 * 멱등 실행: CREATE TABLE/INDEX/COLUMN IF NOT EXISTS 위주.
 * 기존 데이터를 보존하면서 컬럼/테이블/인덱스/외래키를 점진적으로 추가합니다.
 *
 * 실행:
 *   curl -X POST http://localhost:3000/api/db/init
 *
 * 보안:
 *   ADMIN_INIT_TOKEN env 가 설정되어 있으면 Authorization: Bearer <token> 일치할 때만 실행.
 *   미설정이면 누구나 실행 가능 (개발 단계 한정).
 */

import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';

async function runMigration() {
  // ─────────────────────────────────────────────────────────────
  // 0. 확장
  // ─────────────────────────────────────────────────────────────
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  // ─────────────────────────────────────────────────────────────
  // 1. user_profiles — Firebase Auth 미러 + 건강 목표
  // ─────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id            TEXT PRIMARY KEY,
      target_kcal        INTEGER NOT NULL DEFAULT 2000,
      target_glucose_min INTEGER NOT NULL DEFAULT 70,
      target_glucose_max INTEGER NOT NULL DEFAULT 140,
      updated_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS name           TEXT`;
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email          TEXT`;
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS diabetes_type  TEXT`;
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS weight         NUMERIC`;
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS height         NUMERIC`;
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT NOW()`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles (email)`;

  // ─────────────────────────────────────────────────────────────
  // 2. meals — 영양소 + 메타 컬럼 추가
  // ─────────────────────────────────────────────────────────────
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
  await sql`ALTER TABLE meals ADD COLUMN IF NOT EXISTS total_protein  NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE meals ADD COLUMN IF NOT EXISTS total_fat      NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE meals ADD COLUMN IF NOT EXISTS total_sodium   NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE meals ADD COLUMN IF NOT EXISTS image_url      TEXT`;
  await sql`ALTER TABLE meals ADD COLUMN IF NOT EXISTS notes          TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_meals_user_ts        ON meals (user_id, timestamp DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_meals_user_type_ts   ON meals (user_id, meal_type, timestamp DESC)`;

  // ─────────────────────────────────────────────────────────────
  // 3. glucose_readings
  // ─────────────────────────────────────────────────────────────
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
  await sql`CREATE INDEX IF NOT EXISTS idx_glucose_user_ts        ON glucose_readings (user_id, timestamp DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_glucose_user_type_ts   ON glucose_readings (user_id, measurement_type, timestamp DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_glucose_linked_meal    ON glucose_readings (linked_meal_id)`;

  // ─────────────────────────────────────────────────────────────
  // 4. parse_corrections
  // ─────────────────────────────────────────────────────────────
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
  await sql`CREATE INDEX IF NOT EXISTS idx_parse_corr_user_ts ON parse_corrections (user_id, timestamp DESC)`;

  // ─────────────────────────────────────────────────────────────
  // 5. meal_glucose_impacts — 식사별 혈당 영향 캐시
  // ─────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS meal_glucose_impacts (
      meal_id          TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      baseline_bg      INTEGER,
      peak_bg          INTEGER,
      peak_at_min      INTEGER,
      delta_bg         INTEGER,
      bg_2h            INTEGER,
      glucotype_score  TEXT,
      computed_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_mgi_user ON meal_glucose_impacts (user_id, computed_at DESC)`;

  // ─────────────────────────────────────────────────────────────
  // 6. insights — AI 인사이트 영속화
  // ─────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS insights (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      type            TEXT NOT NULL,
      title           TEXT NOT NULL,
      message         TEXT NOT NULL,
      emoji           TEXT,
      action_label    TEXT,
      action_url      TEXT,
      linked_meal_id  TEXT,
      is_read         BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at      TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_insights_user_created ON insights (user_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_insights_user_unread  ON insights (user_id, is_read, created_at DESC)`;

  // ─────────────────────────────────────────────────────────────
  // 7. food_dictionary — 사용자별 음식 학습 사전
  // ─────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS food_dictionary (
      user_id           TEXT NOT NULL,
      food_name         TEXT NOT NULL,
      default_quantity  NUMERIC NOT NULL DEFAULT 1,
      default_unit      TEXT NOT NULL DEFAULT '인분',
      avg_carbs         NUMERIC NOT NULL DEFAULT 0,
      avg_protein       NUMERIC NOT NULL DEFAULT 0,
      avg_fat           NUMERIC NOT NULL DEFAULT 0,
      avg_calories      NUMERIC NOT NULL DEFAULT 0,
      gi                NUMERIC NOT NULL DEFAULT 55,
      correction_count  INTEGER NOT NULL DEFAULT 0,
      use_count         INTEGER NOT NULL DEFAULT 1,
      last_used_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, food_name)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_food_dict_user_lastused ON food_dictionary (user_id, last_used_at DESC)`;

  // ─────────────────────────────────────────────────────────────
  // 8. sync_queue — 오프라인 동기화 idempotency 키
  // ─────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS sync_queue (
      client_uuid      TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      kind             TEXT NOT NULL,
      payload          JSONB NOT NULL,
      synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sync_user_synced ON sync_queue (user_id, synced_at DESC)`;

  // ─────────────────────────────────────────────────────────────
  // 9. 외래키 (NOT VALID — 기존 고아 row 있어도 통과)
  // ─────────────────────────────────────────────────────────────
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_meals_user') THEN
        ALTER TABLE meals
          ADD CONSTRAINT fk_meals_user
          FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
          ON DELETE CASCADE NOT VALID;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_glucose_user') THEN
        ALTER TABLE glucose_readings
          ADD CONSTRAINT fk_glucose_user
          FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
          ON DELETE CASCADE NOT VALID;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_glucose_meal') THEN
        ALTER TABLE glucose_readings
          ADD CONSTRAINT fk_glucose_meal
          FOREIGN KEY (linked_meal_id) REFERENCES meals(id)
          ON DELETE SET NULL NOT VALID;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_parse_corr_user') THEN
        ALTER TABLE parse_corrections
          ADD CONSTRAINT fk_parse_corr_user
          FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
          ON DELETE SET NULL NOT VALID;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mgi_meal') THEN
        ALTER TABLE meal_glucose_impacts
          ADD CONSTRAINT fk_mgi_meal
          FOREIGN KEY (meal_id) REFERENCES meals(id)
          ON DELETE CASCADE NOT VALID;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mgi_user') THEN
        ALTER TABLE meal_glucose_impacts
          ADD CONSTRAINT fk_mgi_user
          FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
          ON DELETE CASCADE NOT VALID;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_insights_user') THEN
        ALTER TABLE insights
          ADD CONSTRAINT fk_insights_user
          FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
          ON DELETE CASCADE NOT VALID;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_insights_meal') THEN
        ALTER TABLE insights
          ADD CONSTRAINT fk_insights_meal
          FOREIGN KEY (linked_meal_id) REFERENCES meals(id)
          ON DELETE SET NULL NOT VALID;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_food_dict_user') THEN
        ALTER TABLE food_dictionary
          ADD CONSTRAINT fk_food_dict_user
          FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
          ON DELETE CASCADE NOT VALID;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sync_user') THEN
        ALTER TABLE sync_queue
          ADD CONSTRAINT fk_sync_user
          FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
          ON DELETE CASCADE NOT VALID;
      END IF;
    END$$;
  `;
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_INIT_TOKEN;
  if (!expected) return true; // 개발 단계: 미설정이면 허용
  const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  return got === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    await runMigration();
    return NextResponse.json({ ok: true, message: '마이그레이션 완료' });
  } catch (error: any) {
    console.error('[db/init] error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    await runMigration();
    return NextResponse.json({ ok: true, message: '마이그레이션 완료' });
  } catch (error: any) {
    console.error('[db/init] error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
