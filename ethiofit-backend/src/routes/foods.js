const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/foods?date=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  const date = req.query.date || localDateStr();
  const { rows } = await db.query(
    `SELECT * FROM foods
     WHERE user_id = $1 AND logged_at::date = $2::date
     ORDER BY logged_at DESC`,
    [req.user.userId, date]
  );
  res.json(rows);
});

// POST /api/foods — accepts optional logged_at from client (local time)
router.post('/', auth, [
  body('name').trim().notEmpty(),
  body('calories').isFloat({ min: 0 }),
  body('protein').optional().isFloat({ min: 0 }),
  body('logged_at').optional().isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { name, calories, protein = 0, logged_at } = req.body;
  const { rows } = await db.query(
    `INSERT INTO foods (user_id, name, calories, protein, logged_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user.userId, name, calories, protein, logged_at || new Date()]
  );
  // Rebuild daily_log for that date
  await rebuildDailyLog(req.user.userId, rows[0].logged_at);
  res.status(201).json(rows[0]);
});

// DELETE /api/foods/:id
router.delete('/:id', auth, async (req, res) => {
  const { rows } = await db.query(
    'DELETE FROM foods WHERE id = $1 AND user_id = $2 RETURNING logged_at',
    [req.params.id, req.user.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await rebuildDailyLog(req.user.userId, rows[0].logged_at);
  res.status(204).send();
});

// Recompute daily_logs for a given date from actual food+exercise rows
async function rebuildDailyLog(userId, loggedAt) {
  const date = new Date(loggedAt).toISOString().slice(0, 10);
  await db.query(
    `INSERT INTO daily_logs (user_id, log_date, calories_in, calories_out, protein)
     SELECT $1, $2::date,
       COALESCE((SELECT SUM(calories) FROM foods     WHERE user_id=$1 AND logged_at::date=$2::date), 0),
       COALESCE((SELECT SUM(calories_burned) FROM exercises WHERE user_id=$1 AND logged_at::date=$2::date), 0),
       COALESCE((SELECT SUM(protein)  FROM foods     WHERE user_id=$1 AND logged_at::date=$2::date), 0)
     ON CONFLICT (user_id, log_date) DO UPDATE SET
       calories_in  = EXCLUDED.calories_in,
       calories_out = EXCLUDED.calories_out,
       protein      = EXCLUDED.protein`,
    [userId, date]
  );
}

function localDateStr() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = router;
module.exports.rebuildDailyLog = rebuildDailyLog;
