const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');


router.get('/', auth, async (req, res) => {
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;

  const { rows } = await db.query(
    `SELECT
       day,
       COALESCE(SUM(calories_in),  0) AS calories_in,
       COALESCE(SUM(calories_out), 0) AS calories_out,
       COALESCE(SUM(protein),      0) AS protein
     FROM (
       SELECT logged_at::date AS day, calories AS calories_in, 0 AS calories_out, protein
       FROM foods
       WHERE user_id = $1
         AND EXTRACT(YEAR  FROM logged_at) = $2
         AND EXTRACT(MONTH FROM logged_at) = $3
       UNION ALL
       SELECT logged_at::date AS day, 0, calories_burned, 0
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
    };
  }
  res.json(result);
});

module.exports = router;
