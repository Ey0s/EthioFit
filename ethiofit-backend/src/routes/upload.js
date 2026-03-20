const router = require('express').Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const db   = require('../db');
const auth = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memory storage — upload buffer directly to Cloudinary via SDK
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// POST /api/profile/avatar
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Upload to Cloudinary with eager transformation — processed once, cached forever on CDN
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'ethiofit/avatars',
          public_id: `user_${req.user.userId}`, // stable ID = same URL on re-upload = instant cache hit
          overwrite: true,
          transformation: [
            { width: 200, height: 200, crop: 'fill', gravity: 'face' },
            { fetch_format: 'auto', quality: 'auto:low' },
          ],
        },
        (err, result) => err ? reject(err) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    // secure_url is already the final optimized CDN URL — no string manipulation needed
    const avatarUrl = result.secure_url;

    await db.query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [avatarUrl, req.user.userId]
    );

    res.json({ avatar_url: avatarUrl });
  } catch (err) {
    console.error('[Upload] error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
