require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const analyzeRoutes = require('./routes/analyze');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://localhost:5174'],
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
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    engines: {
      text: 'active',
      url: 'active',
      audio: 'active',
      image: 'active'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 50MB.' });
  }
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║         🛡️  TrustGuard AI Engine  🛡️          ║
  ║                                              ║
  ║   Server running on port ${PORT}               ║
  ║   API: http://localhost:${PORT}/api            ║
  ║                                              ║
  ║   Engines Status:                            ║
  ║   ✅ Text Analyzer    — Active               ║
  ║   ✅ URL Analyzer     — Active               ║
  ║   ✅ Audio Analyzer   — Active               ║
  ║   ✅ Image Analyzer   — Active               ║
  ║   ✅ Risk Calculator  — Active               ║
  ╚══════════════════════════════════════════════╝
  `);
});

module.exports = app;
