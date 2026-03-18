/**
 * Run once: node src/migrate.js
 * Creates all tables in PostgreSQL.
 */
require('dotenv').config();
const db = require('./db');

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          TEXT        NOT NULL,
      email         TEXT        UNIQUE NOT NULL,
      password_hash TEXT        NOT NULL,
      gender        TEXT        NOT NULL CHECK (gender IN ('male','female')),
      date_of_birth DATE        NOT NULL,
      weight        NUMERIC(5,2) NOT NULL,
      height        NUMERIC(5,2) NOT NULL,
      avatar_url    TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    -- Add avatar_url to existing deployments
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

    CREATE TABLE IF NOT EXISTS goals (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
      goal             TEXT    NOT NULL CHECK (goal IN ('lose','maintain','gain')),
      activity         TEXT    NOT NULL,
      target_calories  INTEGER NOT NULL,
      tdee             INTEGER NOT NULL,
      updated_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id)
    );

    CREATE TABLE IF NOT EXISTS foods (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT           NOT NULL,
      calories   NUMERIC(7,2)   NOT NULL,
      protein    NUMERIC(6,2)   NOT NULL DEFAULT 0,
      logged_at  TIMESTAMPTZ    DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type            TEXT          NOT NULL,
      calories_burned NUMERIC(7,2)  NOT NULL,
      logged_at       TIMESTAMPTZ   DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      log_date     DATE          NOT NULL,
      calories_in  NUMERIC(8,2)  NOT NULL DEFAULT 0,
      calories_out NUMERIC(8,2)  NOT NULL DEFAULT 0,
      protein      NUMERIC(7,2)  NOT NULL DEFAULT 0,
      UNIQUE (user_id, log_date)
    );
  `);
  console.log('✅ Migration complete');
  process.exit(0);
}

migrate().catch((e) => { console.error(e); process.exit(1); });
