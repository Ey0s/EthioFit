require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const db      = require('./db');

const authRoutes      = require('./routes/auth');
const profileRoutes   = require('./routes/profile');
const uploadRoutes    = require('./routes/upload');
const goalRoutes      = require('./routes/goals');
const foodRoutes      = require('./routes/foods');
const exerciseRoutes  = require('./routes/exercises');
const waterRoutes     = require('./routes/water');
const activityRoutes  = require('./routes/activity');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.use('/api/auth',      authRoutes);
app.use('/api/profile',   profileRoutes);
app.use('/api/profile',   uploadRoutes);
app.use('/api/goals',     goalRoutes);
app.use('/api/foods',     foodRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/water',     waterRoutes);
app.use('/api/activity',  activityRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function runMigrations() {
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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

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
    ALTER TABLE goals ADD COLUMN IF NOT EXISTS bmr INTEGER;

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
    ALTER TABLE foods ADD COLUMN IF NOT EXISTS carbs  NUMERIC(6,2) NOT NULL DEFAULT 0;
    ALTER TABLE foods ADD COLUMN IF NOT EXISTS fat    NUMERIC(6,2) NOT NULL DEFAULT 0;
    ALTER TABLE foods ADD COLUMN IF NOT EXISTS fiber  NUMERIC(6,2) NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS exercises (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER      REFERENCES users(id) ON DELETE CASCADE,
      type            TEXT         NOT NULL,
      calories_burned NUMERIC(7,2) NOT NULL,
      duration        INTEGER      NOT NULL DEFAULT 0,
      distance        NUMERIC(8,3) NOT NULL DEFAULT 0,
      pace            NUMERIC(8,3) NOT NULL DEFAULT 0,
      logged_at       TIMESTAMPTZ  DEFAULT NOW()
    );
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS duration INTEGER      NOT NULL DEFAULT 0;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS distance NUMERIC(8,3) NOT NULL DEFAULT 0;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS pace     NUMERIC(8,3) NOT NULL DEFAULT 0;

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
    ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS carbs  NUMERIC(7,2) NOT NULL DEFAULT 0;
    ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS fat    NUMERIC(7,2) NOT NULL DEFAULT 0;
    ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS fiber  NUMERIC(7,2) NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS water (
      id        SERIAL PRIMARY KEY,
      user_id   INTEGER      REFERENCES users(id) ON DELETE CASCADE,
      amount    NUMERIC(7,1) NOT NULL,
      logged_at TIMESTAMPTZ  DEFAULT NOW()
    );
  `);
  console.log('✅ Migrations applied');
}

const PORT = process.env.PORT || 3000;

runMigrations()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 EthioFit API running on port ${PORT}`));
  })
  .catch((e) => {
    console.error('❌ Migration failed, server not started:', e.message);
    process.exit(1);
  });
