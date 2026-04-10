const path = require('path');
const fs = require('fs');

class AudioAnalyzer {
  async analyze(file) {
    if (!file) return { type: 'audio', riskScore: 0, threats: [], indicators: [], details: {} };
    
    // As real-time audio deepfake APIs require heavy asynchronous processing, 
    // we use a fast heuristic + metadata model to maintain low-latency analysis.
    return this._analyzeLocally(file);
  }

  _analyzeLocally(file) {
    let threats = [];
    let indicators = [];
    let score = 0;

    const fileSizeKB = file.size / 1024;
    
    if (fileSizeKB < 10) {
      threats.push({ type: 'SUSPICIOUS_SIZE', category: 'DEEPFAKE', severity: 'medium', description: 'Audio file is unusually small — AI clips are often short.' });
      indicators.push({ keyword: 'Tiny file size', type: 'size', highlight: true });
      score += 30;
    }

    if (file.originalname.toLowerCase().includes('generated') || file.originalname.toLowerCase().includes('clone')) {
      threats.push({ type: 'AI_CLONED_AUDIO', category: 'DEEPFAKE', severity: 'high', description: 'Filename indicates AI generated audio' });
      score += 60;
    }

    return {
      type: 'audio', riskScore: score, threats, indicators,
      details: { fileName: file.originalname, source: 'Heuristics' }
    };
  }
}

module.exports = new AudioAnalyzer();
