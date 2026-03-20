const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db   = require('../db');
const auth = require('../middleware/auth');

// GET /api/goals
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM goals WHERE user_id = $1',
      [req.user.userId]
    );
    res.json(rows[0] ?? null);
  } catch (e) {
    console.error('[goals GET]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/goals — upsert
router.put('/', auth, [
  body('goal').isIn(['lose', 'maintain', 'gain']),
  body('activity').notEmpty(),
  body('target_calories').isInt({ min: 500 }),
  body('tdee').isInt({ min: 500 }),
  body('bmr').optional().isInt({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { goal, activity, target_calories, tdee, bmr = null } = req.body;
    const { rows } = await db.query(
      `INSERT INTO goals (user_id, goal, activity, target_calories, tdee, bmr, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         goal            = EXCLUDED.goal,
         activity        = EXCLUDED.activity,
         target_calories = EXCLUDED.target_calories,
         tdee            = EXCLUDED.tdee,
         bmr             = EXCLUDED.bmr,
         updated_at      = NOW()
       RETURNING *`,
      [req.user.userId, goal, activity, target_calories, tdee, bmr]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error('[goals PUT]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
