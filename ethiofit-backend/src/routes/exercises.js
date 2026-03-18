const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');
const auth = require('../middleware/auth');
const { rebuildDailyLog } = require('./foods');

// GET /api/exercises?date=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const { rows } = await db.query(
    `SELECT * FROM exercises
     WHERE user_id = $1 AND logged_at::date = $2::date
     ORDER BY logged_at DESC`,
    [req.user.userId, date]
  );
  res.json(rows);
});

// POST /api/exercises — accepts optional logged_at from client (local time)
router.post('/', auth, [
  body('type').trim().notEmpty(),
  body('calories_burned').isFloat({ min: 0 }),
  body('logged_at').optional().isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { type, calories_burned, logged_at } = req.body;
  const { rows } = await db.query(
    `INSERT INTO exercises (user_id, type, calories_burned, logged_at)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.userId, type, calories_burned, logged_at || new Date()]
  );
  await rebuildDailyLog(req.user.userId, rows[0].logged_at);
  res.status(201).json(rows[0]);
});

// DELETE /api/exercises/:id
router.delete('/:id', auth, async (req, res) => {
  const { rows } = await db.query(
    'DELETE FROM exercises WHERE id = $1 AND user_id = $2 RETURNING logged_at',
    [req.params.id, req.user.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await rebuildDailyLog(req.user.userId, rows[0].logged_at);
  res.status(204).send();
});

module.exports = router;
