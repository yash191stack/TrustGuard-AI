require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const analyzeRoutes = require('./routes/analyze');
const statsRoutes = require('./routes/stats');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:3000', 
    'http://127.0.0.1:5173', 
    'http://localhost:5174', 
    'http://localhost:5175',
    'http://[::1]:5173'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/analyze', analyzeRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'TrustGuard AI Engine',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    engines: {
      text: 'active',
      url: 'active',
      image: 'active',
      video: 'active',
      preCheckFilter: 'active',
      riskCalculator: 'active'
    },
    optimizations: {
      costOptimization: 'Rule-based Pre-check Layer active',
      videoSampling: 'Key Frame Sampling (7 frames, majority vote)',
      rateLimiting: `${rateLimiter.getStats().maxRequests} req/min per IP`,
      maxFileSize: '10MB',
      riskOutput: '3-tier (Likely Safe / Suspicious / Dangerous)',
      fallbackMode: 'Auto-activate on API failure'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
  }
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server with port error handling
const server = app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║       🛡️  TrustGuard AI Engine v2.0  🛡️              ║
  ║                                                      ║
  ║   Server running on port ${PORT}                       ║
  ║   API: http://localhost:${PORT}/api                    ║
  ║                                                      ║
  ║   🚀 Optimizations Active:                           ║
  ║   ✅ Cost Optimization  — Pre-check Filter Layer     ║
  ║   ✅ Video Sampling     — Key Frame (7 frames)       ║
  ║   ✅ Rate Limiting      — 30 req/min per IP          ║
  ║   ✅ File Size Cap      — 10MB max                   ║
  ║   ✅ Risk Output        — 3-Tier Categories          ║
  ║   ✅ Fallback Mode      — Auto on API failure        ║
  ╚══════════════════════════════════════════════════════╝
  `);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Error: Port ${PORT} is already in use. Please kill the existing process or use a different port.`);
    process.exit(1);
  } else {
    console.error('❌ Server failed to start:', err.message);
  }
});

module.exports = app;
