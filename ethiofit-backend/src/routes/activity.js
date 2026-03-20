const router = require('express').Router();
const db   = require('../db');
const auth = require('../middleware/auth');

// GET /api/activity?year=YYYY&month=M
router.get('/', auth, async (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    const { rows } = await db.query(
      `SELECT
         day,
         COALESCE(SUM(calories_in),  0) AS calories_in,
         COALESCE(SUM(calories_out), 0) AS calories_out,
         COALESCE(SUM(protein),      0) AS protein,
         COALESCE(SUM(carbs),        0) AS carbs,
         COALESCE(SUM(fat),          0) AS fat,
         COALESCE(SUM(fiber),        0) AS fiber
       FROM (
         SELECT logged_at::date AS day,
                calories AS calories_in, 0 AS calories_out,
                protein, carbs, fat, fiber
         FROM foods
         WHERE user_id = $1
           AND EXTRACT(YEAR  FROM logged_at) = $2
           AND EXTRACT(MONTH FROM logged_at) = $3
         UNION ALL
         SELECT logged_at::date AS day,
                0, calories_burned AS calories_out,
                0 AS protein, 0 AS carbs, 0 AS fat, 0 AS fiber
         FROM exercises
         WHERE user_id = $1
           AND EXTRACT(YEAR  FROM logged_at) = $2
           AND EXTRACT(MONTH FROM logged_at) = $3
       ) t
       GROUP BY day
       ORDER BY day`,
      [req.user.userId, year, month]
    );

    const result = {};
    for (const row of rows) {
      const key = row.day instanceof Date
        ? row.day.toISOString().slice(0, 10)
        : String(row.day).slice(0, 10);
      result[key] = {
        calories_in:  parseFloat(row.calories_in),
        calories_out: parseFloat(row.calories_out),
        protein:      parseFloat(row.protein),
        carbs:        parseFloat(row.carbs),
        fat:          parseFloat(row.fat),
        fiber:        parseFloat(row.fiber),
      };
    }
    res.json(result);
  } catch (e) {
    console.error('[activity GET]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
