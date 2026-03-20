const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db   = require('../db');
const auth = require('../middleware/auth');
const { rebuildDailyLog } = require('./foods');

// GET /api/exercises?date=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const { rows } = await db.query(
      `SELECT * FROM exercises
       WHERE user_id = $1 AND logged_at::date = $2::date
       ORDER BY logged_at DESC`,
      [req.user.userId, date]
    );
    res.json(rows);
  } catch (e) {
    console.error('[exercises GET]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/exercises
router.post('/', auth, [
  body('type').trim().notEmpty(),
  body('calories_burned').isFloat({ min: 0 }),
  body('duration').optional().isInt({ min: 0 }),
  body('distance').optional().isFloat({ min: 0 }),
  body('pace').optional().isFloat({ min: 0 }),
  body('logged_at').optional(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { type, calories_burned, duration = 0, distance = 0, pace = 0, logged_at } = req.body;
    const ts = logged_at ? new Date(logged_at) : new Date();

    const { rows } = await db.query(
      `INSERT INTO exercises (user_id, type, calories_burned, duration, distance, pace, logged_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.userId, type, calories_burned, duration, distance, pace, ts]
    );
    await rebuildDailyLog(req.user.userId, rows[0].logged_at);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('[exercises POST]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/exercises/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'DELETE FROM exercises WHERE id = $1 AND user_id = $2 RETURNING logged_at',
      [req.params.id, req.user.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    await rebuildDailyLog(req.user.userId, rows[0].logged_at);
    res.status(204).send();
  } catch (e) {
    console.error('[exercises DELETE]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
