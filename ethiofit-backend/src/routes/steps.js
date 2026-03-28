const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db   = require('../db');
const auth = require('../middleware/auth');

// GET /api/steps?date=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const { rows } = await db.query(
      `SELECT * FROM steps WHERE user_id=$1 AND log_date=$2::date`,
      [req.user.userId, date]
    );
    res.json(rows[0] ?? { steps: 0, distance_km: 0, calories: 0 });
  } catch (e) {
    console.error('[steps GET]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/steps — upsert today's step count
router.post('/', auth, [
  body('steps').isInt({ min: 0 }),
  body('distance_km').optional().isFloat({ min: 0 }),
  body('calories').optional().isFloat({ min: 0 }),
  body('log_date').optional(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const { steps, distance_km = 0, calories = 0, log_date } = req.body;
    const date = log_date ? log_date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const { rows } = await db.query(
      `INSERT INTO steps (user_id, log_date, steps, distance_km, calories)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, log_date) DO UPDATE SET
         steps       = EXCLUDED.steps,
         distance_km = EXCLUDED.distance_km,
         calories    = EXCLUDED.calories
       RETURNING *`,
      [req.user.userId, date, steps, distance_km, calories]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error('[steps POST]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/steps/history?days=7
router.get('/history', auth, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const { rows } = await db.query(
      `SELECT log_date, steps, distance_km, calories
       FROM steps
       WHERE user_id=$1 AND log_date >= NOW() - INTERVAL '${days} days'
       ORDER BY log_date DESC`,
      [req.user.userId]
    );
    res.json(rows);
  } catch (e) {
    console.error('[steps history]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
