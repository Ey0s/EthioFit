const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db   = require('../db');
const auth = require('../middleware/auth');

function calcAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatUser(u) {
  return {
    id:            u.id,
    name:          u.name,
    email:         u.email,
    gender:        u.gender,
    date_of_birth: u.date_of_birth,
    weight:        parseFloat(u.weight),
    height:        parseFloat(u.height),
    avatar_url:    u.avatar_url ?? null,
    age:           calcAge(u.date_of_birth),
  };
}

// GET /api/profile
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, gender, date_of_birth, weight, height, avatar_url FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(formatUser(rows[0]));
  } catch (e) {
    console.error('[profile GET]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/profile
router.patch('/', auth, [
  body('weight').optional().isFloat({ min: 20, max: 300 }),
  body('height').optional().isFloat({ min: 50, max: 250 }),
  body('date_of_birth').optional().isDate(),
  body('name').optional().trim().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const allowed = ['weight', 'height', 'date_of_birth', 'name'];
    const fields  = [];
    const values  = [];
    let i = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    values.push(req.user.userId);
    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, name, email, gender, date_of_birth, weight, height, avatar_url`,
      values
    );
    res.json(formatUser(rows[0]));
  } catch (e) {
    console.error('[profile PATCH]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
