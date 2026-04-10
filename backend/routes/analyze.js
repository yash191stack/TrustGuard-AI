const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const textAnalyzer = require('../engines/textAnalyzer');
const urlAnalyzer = require('../engines/urlAnalyzer');
const audioAnalyzer = require('../engines/audioAnalyzer');
const imageAnalyzer = require('../engines/imageAnalyzer');
const documentAnalyzer = require('../engines/documentAnalyzer');
const videoAnalyzer = require('../engines/videoAnalyzer');
const riskCalculator = require('../engines/riskCalculator');
const fs = require('fs');

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
    const analysis = await documentAnalyzer.analyze(req.file);
    const result = riskCalculator.calculateFinalResult(analysis);
    result.inputPreview = req.file.originalname;
    updateHistory(result);
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
    const analysis = await audioAnalyzer.analyze(req.file);
    const result = riskCalculator.calculateFinalResult(analysis);
    result.inputPreview = req.file.originalname;
    updateHistory(result);
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
    const analysis = await imageAnalyzer.analyze(req.file);
    const result = riskCalculator.calculateFinalResult(analysis);
    result.inputPreview = req.file.originalname;
    updateHistory(result);
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
    const analysis = await videoAnalyzer.analyze(req.file);
    const result = riskCalculator.calculateFinalResult(analysis);
    result.inputPreview = req.file.originalname;
    updateHistory(result);
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
