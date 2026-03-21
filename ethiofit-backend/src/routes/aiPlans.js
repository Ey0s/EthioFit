const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db   = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { type } = req.query;
    const { rows } = await db.query(
      `SELECT * FROM ai_plans WHERE user_id=$1 ${type ? 'AND type=$2' : ''} ORDER BY created_at DESC LIMIT 10`,
      type ? [req.user.userId, type] : [req.user.userId]
    );
    res.json(rows);
  } catch (e) {
    console.error('[ai-plans GET]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, [
  body('type').isIn(['meal', 'exercise']),
  body('display_text').notEmpty(),
  body('items').isArray(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const { type, display_text, items } = req.body;
    const { rows } = await db.query(
      `INSERT INTO ai_plans (user_id, type, display_text, items, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [req.user.userId, type, display_text, JSON.stringify(items)]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('[ai-plans POST]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
