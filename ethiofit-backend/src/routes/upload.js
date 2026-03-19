const router = require('express').Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const db = require('../db');
const auth = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ethiofit/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    // Resize on upload, deliver as WebP with auto quality for fast loading
    transformation: [
      { width: 200, height: 200, crop: 'fill', gravity: 'face' },
      { fetch_format: 'auto', quality: 'auto' },
    ],
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/profile/avatar
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Inject f_auto,q_auto into the Cloudinary URL for fast delivery
    let avatarUrl = req.file.path;
    avatarUrl = avatarUrl.replace('/upload/', '/upload/f_auto,q_auto,w_200,h_200,c_fill/');

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
