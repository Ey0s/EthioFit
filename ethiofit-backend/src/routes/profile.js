const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');
const auth = require('../middleware/auth');

function calcAge(dob) {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// GET /api/profile
router.get('/', auth, async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, name, email, gender, date_of_birth, weight, height, avatar_url FROM users WHERE id = $1',
    [req.user.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  const u = rows[0];
  res.json({ ...u, age: calcAge(u.date_of_birth), weight: parseFloat(u.weight), height: parseFloat(u.height) });
});

// PATCH /api/profile
router.patch('/', auth, [
  body('weight').optional().isFloat({ min: 20, max: 300 }),
  body('height').optional().isFloat({ min: 50, max: 250 }),
  body('date_of_birth').optional().isDate(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const fields = [];
  const values = [];
  let i = 1;

  if (req.body.weight !== undefined)        { fields.push('weight = $' + (i++));        values.push(req.body.weight); }
  if (req.body.height !== undefined)        { fields.push('height = $' + (i++));        values.push(req.body.height); }
  if (req.body.date_of_birth !== undefined) { fields.push('date_of_birth = $' + (i++)); values.push(req.body.date_of_birth); }

  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.user.userId);
  const sql = 'UPDATE users SET ' + fields.join(', ') + ' WHERE id = $' + i + ' RETURNING id, name, email, gender, date_of_birth, weight, height, avatar_url';
  const { rows } = await db.query(sql, values);
  const u = rows[0];
  res.json({ ...u, age: calcAge(u.date_of_birth), weight: parseFloat(u.weight), height: parseFloat(u.height) });
});

module.exports = router;
