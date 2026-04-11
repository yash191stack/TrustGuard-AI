const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const rateLimiter = require('../middleware/rateLimiter');
const textAnalyzer = require('../engines/textAnalyzer');
const urlAnalyzer = require('../engines/urlAnalyzer');
const audioAnalyzer = require('../engines/audioAnalyzer');
const imageAnalyzer = require('../engines/imageAnalyzer');
const documentAnalyzer = require('../engines/documentAnalyzer');
const videoAnalyzer = require('../engines/videoAnalyzer');
const arayaAnalyzer = require('../engines/arayaAnalyzer');
const riskCalculator = require('../engines/riskCalculator');
const statsRouter = require('./stats');
const fs = require('fs');

// ─── HELPER: Record scan into live stats ──────────────────────
const recordLiveScan = (result) => {
  try { statsRouter.recordScan(result); } catch (e) { /* non-blocking */ }
};

// ─── BYPASS RATE LIMIT FOR LIVE STREAM ───────────────────────────
// POST /api/analyze/realtime-deepfake
router.post('/realtime-deepfake', async (req, res) => {
  try {
    const { frame, centerAvg, edgeAvg } = req.body;
    if (!frame) {
      return res.status(400).json({ error: 'Frame data is required' });
    }
    const analysis = await arayaAnalyzer.analyze(frame, centerAvg, edgeAvg);
    res.json(analysis);
  } catch (error) {
    console.error('Realtime deepfake analysis error:', error);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

// ─── RATE LIMITING: Apply to all other analyze routes ────────────────
router.use(rateLimiter.middleware());

// In-memory scan history
const scanHistory = [];

// Helper
const updateHistory = (result) => {
  scanHistory.unshift(result);
  if (scanHistory.length > 100) scanHistory.pop();
};

const cleanup = (req) => {
  if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} }
};

// ─── MAX FILE SIZE (10MB) ──────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const validateFileSize = (req, res) => {
  if (req.file && req.file.size > MAX_FILE_SIZE) {
    cleanup(req);
    res.status(413).json({
      error: 'File too large',
      message: `Maximum file size is 10MB. Your file is ${(req.file.size / (1024 * 1024)).toFixed(2)}MB.`
    });
    return false;
  }
  return true;
};

// POST /api/analyze/text
router.post('/text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text content is required' });
    }
    const analysis = await textAnalyzer.analyze(text);
    const result = riskCalculator.calculateFinalResult(analysis);
    result.inputPreview = text.substring(0, 200) + (text.length > 200 ? '...' : '');
    updateHistory(result);
    recordLiveScan(result);
    res.json(result);
  } catch (error) {
    console.error('Text analysis error:', error);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

// POST /api/analyze/url
router.post('/url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || url.trim().length === 0) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const analysis = await urlAnalyzer.analyze(url);
    const result = riskCalculator.calculateFinalResult(analysis);
    result.inputPreview = url;
    updateHistory(result);
    recordLiveScan(result);
    res.json(result);
  } catch (error) {
    console.error('URL analysis error:', error);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

// POST /api/analyze/document
router.post('/document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required' });
    }
    if (!validateFileSize(req, res)) return;
    const analysis = await documentAnalyzer.analyze(req.file);
    const result = riskCalculator.calculateFinalResult(analysis);
    result.inputPreview = req.file.originalname;
    updateHistory(result);
    recordLiveScan(result);
    cleanup(req);
    res.json(result);
  } catch (error) {
    console.error('Document analysis error:', error);
    cleanup(req);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

// POST /api/analyze/audio
router.post('/audio', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    if (!validateFileSize(req, res)) return;
    const analysis = await audioAnalyzer.analyze(req.file);
    const result = riskCalculator.calculateFinalResult(analysis);
    result.inputPreview = req.file.originalname;
    updateHistory(result);
    recordLiveScan(result);
    cleanup(req);
    res.json(result);
  } catch (error) {
    console.error('Audio analysis error:', error);
    cleanup(req);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

// POST /api/analyze/image
router.post('/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }
    if (!validateFileSize(req, res)) return;
    const analysis = await imageAnalyzer.analyze(req.file);
    const result = riskCalculator.calculateFinalResult(analysis);
    result.inputPreview = req.file.originalname;
    updateHistory(result);
    recordLiveScan(result);
    cleanup(req);
    res.json(result);
  } catch (error) {
    console.error('Image analysis error:', error);
    cleanup(req);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});



// POST /api/analyze/video
router.post('/video', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Video file is required' });
    }
    if (!validateFileSize(req, res)) return;
    const analysis = await videoAnalyzer.analyze(req.file);

    // Check if video was rejected for being too large
    if (analysis.rejected) {
      cleanup(req);
      return res.status(413).json({
        error: 'Video too large or too long',
        message: analysis.details.error
      });
    }

    const result = riskCalculator.calculateFinalResult(analysis);
    result.inputPreview = req.file.originalname;
    updateHistory(result);
    recordLiveScan(result);
    cleanup(req);
    res.json(result);
  } catch (error) {
    console.error('Video analysis error:', error);
    cleanup(req);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

// GET /api/analyze/history
router.get('/history', (req, res) => {
  res.json(scanHistory.slice(0, 50));
});

module.exports = router;
