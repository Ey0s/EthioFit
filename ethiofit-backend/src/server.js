require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');

const authRoutes      = require('./routes/auth');
const profileRoutes   = require('./routes/profile');
const uploadRoutes    = require('./routes/upload');
const goalRoutes      = require('./routes/goals');
const foodRoutes      = require('./routes/foods');
const exerciseRoutes  = require('./routes/exercises');
const activityRoutes  = require('./routes/activity');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.use('/api/auth',      authRoutes);
app.use('/api/profile',   profileRoutes);
app.use('/api/profile',   uploadRoutes);
app.use('/api/goals',     goalRoutes);
app.use('/api/foods',     foodRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/activity',  activityRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 EthioFit API running on port ${PORT}`));
