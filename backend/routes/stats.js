const express = require('express');
const router = express.Router();
const threatIntel = require('../data/threatIntel.json');

// GET /api/stats
router.get('/', (req, res) => {
  res.json({
    globalStats: threatIntel.globalStats,
    platformStats: {
      totalScans: Math.floor(Math.random() * 50000) + 125000,
      threatsDetected: Math.floor(Math.random() * 20000) + 45000,
      phishingBlocked: Math.floor(Math.random() * 10000) + 32000,
      scamsIdentified: Math.floor(Math.random() * 8000) + 18000,
      deepfakesDetected: Math.floor(Math.random() * 3000) + 5000,
      usersProtected: Math.floor(Math.random() * 10000) + 75000,
      avgResponseTime: '1.2s',
      accuracyRate: '97.3%'
    },
    threatCategories: threatIntel.threatCategories,
    riskLevels: threatIntel.riskLevels,
    recentThreats: [
      { type: 'Phishing', target: 'Banking credentials', region: 'South Asia', severity: 'Critical', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { type: 'Deepfake', target: 'Voice impersonation', region: 'Global', severity: 'High', timestamp: new Date(Date.now() - 7200000).toISOString() },
      { type: 'Scam', target: 'UPI payment fraud', region: 'India', severity: 'Critical', timestamp: new Date(Date.now() - 10800000).toISOString() },
      { type: 'Phishing', target: 'Social media accounts', region: 'Global', severity: 'High', timestamp: new Date(Date.now() - 14400000).toISOString() },
      { type: 'Malware', target: 'Fake APK distribution', region: 'Southeast Asia', severity: 'Critical', timestamp: new Date(Date.now() - 18000000).toISOString() }
    ]
  });
});

module.exports = router;
