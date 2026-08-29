const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');

// Both client IDs are trusted — Google issues tokens against the Android or iOS client
const TRUSTED_CLIENT_IDS = [
  '1047418804850-48om6gj4t0fvaq8cmrf86f087jpslo2k.apps.googleusercontent.com', // Android
  '1047418804850-jhbsksmaud16enf35jvmkrl4ei2ljg5n.apps.googleusercontent.com', // iOS
];

const client = new OAuth2Client();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

function calcAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// POST /api/auth/google
// Body: { idToken: string } OR { accessToken, email, name, picture }
router.post('/', async (req, res) => {
  const { idToken, accessToken, email: aEmail, name: aName, picture: aPicture } = req.body;

  let email, name, picture, googleId;

  if (idToken) {
    // Primary path — verify the Google ID token
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: TRUSTED_CLIENT_IDS,
      });
      const payload = ticket.getPayload();
      email    = payload.email;
      name     = payload.name;
      picture  = payload.picture;
      googleId = payload.sub;
    } catch (e) {
      console.error('[Google Auth] token verification failed:', e.message);
      return res.status(401).json({ error: 'Invalid Google token' });
    }
  } else if (accessToken && aEmail) {
    // Fallback path — verify access token by calling Google userinfo
    try {
      const infoRes = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!infoRes.ok) throw new Error('Google userinfo request failed');
      const info = await infoRes.json();
      email    = info.email;
      name     = info.name;
      picture  = info.picture;
      googleId = info.id;
    } catch (e) {
      console.error('[Google Auth] accessToken verification failed:', e.message);
      return res.status(401).json({ error: 'Invalid Google access token' });
    }
  } else {
    return res.status(400).json({ error: 'idToken or accessToken is required' });
  }

  if (!email) return res.status(400).json({ error: 'Google account has no email' });

  try {
    // Check if user already exists by email
    let { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    let user = rows[0];

    if (!user) {
      // New user — create account with Google data
      // Use sensible defaults for required fields (user can complete profile later)
      const { rows: newRows } = await db.query(
        `INSERT INTO users (name, email, password_hash, gender, date_of_birth, weight, height, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          name || email.split('@')[0],
          email.toLowerCase(),
          `google:${googleId}`,  // non-bcrypt sentinel — prevents password login
          'male',                 // default, user can change in Profile
          '1990-01-01',          // default placeholder
          70,
          170,
          picture || null,
        ]
      );
      user = newRows[0];
    } else if (user.avatar_url !== picture && picture) {
      // Update avatar if changed
      await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [picture, user.id]);
      user.avatar_url = picture;
    }

    const token = signToken(user.id);
    return res.json({
      token,
      user: {
        id:            user.id,
        name:          user.name,
        email:         user.email,
        gender:        user.gender,
        date_of_birth: user.date_of_birth,
        age:           calcAge(user.date_of_birth),
        weight:        parseFloat(user.weight),
        height:        parseFloat(user.height),
        avatar_url:    user.avatar_url,
      },
      isNewUser: rows.length === 0,
    });
  } catch (e) {
    console.error('[Google Auth] db error:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
