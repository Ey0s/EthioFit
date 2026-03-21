const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db   = require('../db');
const auth = require('../middleware/auth');

// GET /api/foods?date=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const { rows } = await db.query(
      `SELECT * FROM foods
       WHERE user_id = $1 AND logged_at::date = $2::date
       ORDER BY logged_at DESC`,``
      [req.user.userId, date]
    );
    res.json(rows);
  } catch (e) {
    console.error('[foods GET]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/foods
router.post('/', auth, [
  body('name').trim().notEmpty(),
  body('calories').isFloat({ min: 0 }),
  body('protein').optional().isFloat({ min: 0 }),
  body('carbs').optional().isFloat({ min: 0 }),
  body('fat').optional().isFloat({ min: 0 }),
  body('fiber').optional().isFloat({ min: 0 }),
  body('logged_at').optional(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { name, calories, protein = 0, carbs = 0, fat = 0, fiber = 0, logged_at } = req.body;
    const ts = logged_at ? new Date(logged_at.replace(' ', 'T')) : new Date();

    const { rows } = await db.query(
      `INSERT INTO foods (user_id, name, calories, protein, carbs, fat, fiber, logged_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.userId, name, calories, protein, carbs, fat, fiber, ts]
    );
    await rebuildDailyLog(req.user.userId, rows[0].logged_at);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('[foods POST]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/foods/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'DELETE FROM foods WHERE id = $1 AND user_id = $2 RETURNING logged_at',
      [req.params.id, req.user.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    await rebuildDailyLog(req.user.userId, rows[0].logged_at);
    res.status(204).send();
  } catch (e) {
    console.error('[foods DELETE]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Recompute daily_logs for a given date from actual food + exercise rows
async function rebuildDailyLog(userId, loggedAt) {
  const date = new Date(loggedAt).toISOString().slice(0, 10);
  await db.query(
    `INSERT INTO daily_logs (user_id, log_date, calories_in, calories_out, protein, carbs, fat, fiber)
     SELECT $1, $2::date,
       COALESCE((SELECT SUM(calories)       FROM foods     WHERE user_id=$1 AND logged_at::date=$2::date), 0),
       COALESCE((SELECT SUM(calories_burned) FROM exercises WHERE user_id=$1 AND logged_at::date=$2::date), 0),
       COALESCE((SELECT SUM(protein)        FROM foods     WHERE user_id=$1 AND logged_at::date=$2::date), 0),
       COALESCE((SELECT SUM(carbs)          FROM foods     WHERE user_id=$1 AND logged_at::date=$2::date), 0),
       COALESCE((SELECT SUM(fat)            FROM foods     WHERE user_id=$1 AND logged_at::date=$2::date), 0),
       COALESCE((SELECT SUM(fiber)          FROM foods     WHERE user_id=$1 AND logged_at::date=$2::date), 0)
     ON CONFLICT (user_id, log_date) DO UPDATE SET
       calories_in  = EXCLUDED.calories_in,
       calories_out = EXCLUDED.calories_out,
       protein      = EXCLUDED.protein,
       carbs        = EXCLUDED.carbs,
       fat          = EXCLUDED.fat,
       fiber        = EXCLUDED.fiber`,
    [userId, date]
  );
}

module.exports = router;
module.exports.rebuildDailyLog = rebuildDailyLog;
