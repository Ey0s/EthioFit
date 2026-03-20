const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db   = require('../db');
const auth = require('../middleware/auth');

// GET /api/water?date=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const { rows } = await db.query(
      `SELECT * FROM water WHERE user_id=$1 AND logged_at::date=$2::date ORDER BY logged_at DESC`,
      [req.user.userId, date]
    );
    res.json(rows);
  } catch (e) {
    console.error('[water GET]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/water
router.post('/', auth, [
  body('amount').isFloat({ min: 1 }),
  body('logged_at').optional(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const { amount, logged_at } = req.body;
    const ts = logged_at ? new Date(logged_at) : new Date();
    const { rows } = await db.query(
      `INSERT INTO water (user_id, amount, logged_at) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.userId, amount, ts]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('[water POST]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/water/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'DELETE FROM water WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    console.error('[water DELETE]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
