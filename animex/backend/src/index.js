const express    = require('express');
const cors       = require('cors');
const mongoose   = require('mongoose');
const rateLimit  = require('express-rate-limit');
require('dotenv').config();

const authRoutes   = require('./routes/auth');
const animeRoutes  = require('./routes/anime');
const userRoutes   = require('./routes/user');
const searchRoutes = require('./routes/search');
const proxyRoutes  = require('./utils/proxy');
const systemRoutes = require('./routes/systemRoutes');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Trust proxy ───────────────────────────────────────────────────
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => req.path === '/health',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Logging ───────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/anime',  animeRoutes);
app.use('/api/user',   userRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/proxy',  proxyRoutes);
app.use('/backend-api/proxy', proxyRoutes);
app.use('/api/system', systemRoutes);

// ── Health ────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const { cache } = require('./cache');
  res.json({
    status: 'ok',
    version: '2.0.0',
    uptime: Math.floor(process.uptime()),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cache: cache.stats(),
    memory: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    env: process.env.NODE_ENV || 'development',
  });
});

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[Server Error]', err);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ── MongoDB ─────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.warn("⚠️ MONGO_URI / MONGODB_URI not found. Auth and History features will be disabled.");
  app.listen(PORT, () => {
    console.log(`🚀 API running on port ${PORT} (Database disabled)`);
  });
} else {
  mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    const safe = MONGO_URI.replace(/:\/\/[^@]+@/, '://***@');
    console.log(`✅ MongoDB: ${safe}`);

    // Try to require and start background workers if engine exists
    try {
      const { startBackgroundWorkers } = require('./engine/storage/backgroundWorker');
      startBackgroundWorkers();
      console.log('✅ Background workers started');
    } catch (e) {
      console.error('Failed to start background workers:', e.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 API running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB failed:', err.message);
    app.listen(PORT, () => {
      console.log(`🚀 API running on port ${PORT} (Database unavailable)`);
    });
  });
}

// ── Graceful shutdown ─────────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = app;
