/**
 * Run once: node src/migrate.js
 * Creates all tables and applies incremental column additions.
 */
require('dotenv').config();
const db = require('./db');

async function migrate() {
  // ── Core tables ──────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          TEXT         NOT NULL,
      email         TEXT         UNIQUE NOT NULL,
      password_hash TEXT         NOT NULL,
      gender        TEXT         NOT NULL CHECK (gender IN ('male','female')),
      date_of_birth DATE         NOT NULL,
      weight        NUMERIC(5,2) NOT NULL,
      height        NUMERIC(5,2) NOT NULL,
      avatar_url    TEXT,
      created_at    TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS goals (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
      goal             TEXT    NOT NULL CHECK (goal IN ('lose','maintain','gain')),
      activity         TEXT    NOT NULL,
      target_calories  INTEGER NOT NULL,
      tdee             INTEGER NOT NULL,
      bmr              INTEGER,
      updated_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id)
    );

    CREATE TABLE IF NOT EXISTS foods (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER      REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT         NOT NULL,
      calories   NUMERIC(7,2) NOT NULL,
      protein    NUMERIC(6,2) NOT NULL DEFAULT 0,
      carbs      NUMERIC(6,2) NOT NULL DEFAULT 0,
      fat        NUMERIC(6,2) NOT NULL DEFAULT 0,
      fiber      NUMERIC(6,2) NOT NULL DEFAULT 0,
      logged_at  TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER      REFERENCES users(id) ON DELETE CASCADE,
      type            TEXT         NOT NULL,
      calories_burned NUMERIC(7,2) NOT NULL,
      duration        NUMERIC(7,2) NOT NULL DEFAULT 0,
      distance        NUMERIC(7,2) NOT NULL DEFAULT 0,
      pace            NUMERIC(7,2) NOT NULL DEFAULT 0,
      logged_at       TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS water (
      id        SERIAL PRIMARY KEY,
      user_id   INTEGER      REFERENCES users(id) ON DELETE CASCADE,
      amount    NUMERIC(7,2) NOT NULL,
      logged_at TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER      REFERENCES users(id) ON DELETE CASCADE,
      log_date     DATE         NOT NULL,
      calories_in  NUMERIC(8,2) NOT NULL DEFAULT 0,
      calories_out NUMERIC(8,2) NOT NULL DEFAULT 0,
      protein      NUMERIC(7,2) NOT NULL DEFAULT 0,
      carbs        NUMERIC(7,2) NOT NULL DEFAULT 0,
      fat          NUMERIC(7,2) NOT NULL DEFAULT 0,
      fiber        NUMERIC(7,2) NOT NULL DEFAULT 0,
      UNIQUE (user_id, log_date)
    );

    CREATE TABLE IF NOT EXISTS steps (
      id        SERIAL PRIMARY KEY,
      user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
      log_date  DATE    NOT NULL,
      steps     INTEGER NOT NULL DEFAULT 0,
      UNIQUE (user_id, log_date)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      log_date     DATE    NOT NULL,
      calories_in  NUMERIC(8,2) NOT NULL DEFAULT 0,
      calories_out NUMERIC(8,2) NOT NULL DEFAULT 0,
      UNIQUE (user_id, log_date)
    );

    CREATE TABLE IF NOT EXISTS ai_plans (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type         TEXT    NOT NULL,
      plan_data    JSONB   NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Incremental ALTER TABLE for existing deployments ─────────────────────
  // Safe to run multiple times — IF NOT EXISTS / IF EXISTS guards prevent errors.
  const alters = [
    // users
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,

    // goals
    `ALTER TABLE goals ADD COLUMN IF NOT EXISTS bmr INTEGER`,

    // foods
    `ALTER TABLE foods ADD COLUMN IF NOT EXISTS carbs NUMERIC(6,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE foods ADD COLUMN IF NOT EXISTS fat   NUMERIC(6,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE foods ADD COLUMN IF NOT EXISTS fiber NUMERIC(6,2) NOT NULL DEFAULT 0`,

    // exercises
    `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS duration NUMERIC(7,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS distance NUMERIC(7,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS pace     NUMERIC(7,2) NOT NULL DEFAULT 0`,

    // daily_logs
    `ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS carbs NUMERIC(7,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS fat   NUMERIC(7,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS fiber NUMERIC(7,2) NOT NULL DEFAULT 0`,
  ];

  for (const sql of alters) {
    try {
      await db.query(sql);
    } catch (e) {
      console.warn('ALTER skipped:', e.message);
    }
  }

  console.log('✅ Migration complete');
  process.exit(0);
}

migrate().catch((e) => { console.error(e); process.exit(1); });
