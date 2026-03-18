const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT),
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendWelcomeEmail({ name, email }) {
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      email,
    subject: '🇪🇹 Welcome to EthioFit!',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #eee">
        <h1 style="color:#e53935;margin-bottom:4px">🇪🇹 EthioFit</h1>
        <p style="color:#888;margin-top:0">Ethiopian Food & Fitness Tracker</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
        <h2 style="color:#1a1a1a">Welcome, ${name}! 👋</h2>
        <p style="color:#444;line-height:1.6">
          Your account is ready. You can now start tracking your meals, exercises,
          and working towards your fitness goals — with a focus on Ethiopian foods
          you love.
        </p>
        <ul style="color:#444;line-height:2">
          <li>🍽️ Log Ethiopian & international foods</li>
          <li>💪 Track your daily exercises</li>
          <li>🎯 Set calorie goals based on your body</li>
          <li>📊 Monitor calories in vs. out</li>
        </ul>
        <a href="#" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#e53935;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">
          Open EthioFit
        </a>
        <p style="color:#bbb;font-size:12px;margin-top:32px">
          You're receiving this because you registered at EthioFit.
        </p>
      </div>
    `,
  });
}

module.exports = { sendWelcomeEmail };
