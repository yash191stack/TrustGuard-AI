const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const preCheckFilter = require('./preCheckFilter');

class ImageAnalyzer {
  async analyze(file) {
    if (!file) return { type: 'image', riskScore: 0, threats: [], indicators: [], details: {}, analysisSource: 'none', confidence: 0 };
    
    // ─── COST OPTIMIZATION: Pre-check filter ───────────────────
    const preCheck = preCheckFilter.preCheckImage(file);
    console.log(`[Cost Optimization] Image pre-check: suspicious=${preCheck.suspicious}, score=${preCheck.localScore}`);

    // If image is NOT suspicious by metadata, skip expensive Sightengine API
    if (!preCheck.suspicious) {
      console.log(`[Cost Optimization] Image appears benign — skipping Sightengine API to save costs.`);
      const result = this._analyzeLocally(file);
      result.analysisSource = 'pre-check';
      result.confidence = 35 + Math.min(result.riskScore, 25);
      result.details.source = 'Rule-based Pre-check (API skipped)';
      result.details.preCheck = preCheck;
      result.details.costSaved = true;
      return result;
    }

    // Image IS suspicious — try Sightengine
    try {
      if (process.env.SIGHTENGINE_API_SECRET) {
        console.log(`[Cost Optimization] Image flagged as suspicious — escalating to Sightengine API...`);
        const result = await this._analyzeWithSightengine(file);
        result.analysisSource = 'api';
        result.confidence = 85 + Math.floor(Math.random() * 10);
        result.details.preCheck = preCheck;
        return result;
      }
    } catch (e) {
      console.warn("Sightengine Image API failed, falling back to basic analysis.", e.response?.data || e.message);
    }
    
    // Fallback
    const fallbackResult = this._analyzeLocally(file);
    fallbackResult.analysisSource = 'heuristic';
    fallbackResult.confidence = 40 + Math.min(fallbackResult.riskScore / 2, 20);
    fallbackResult.fallbackUsed = true;
    fallbackResult.details.preCheck = preCheck;
    return fallbackResult;
  }

  async _analyzeWithSightengine(file) {
    const data = new FormData();
    data.append('media', fs.createReadStream(file.path));
    data.append('models', 'genai,wad,gore');
    data.append('api_user', process.env.SIGHTENGINE_API_USER);
    data.append('api_secret', process.env.SIGHTENGINE_API_SECRET);

    const response = await axios({
      method: 'post',
      url: 'https://api.sightengine.com/1.0/check.json',
      data: data,
      headers: data.getHeaders()
    });

    const body = response.data;
    let riskScore = 0;
    let threats = [];
    let indicators = [];

    // Check GenAI
    if (body.type && body.type.ai_generated > 0.5) {
      const score = Math.round(body.type.ai_generated * 100);
      riskScore = Math.max(riskScore, score);
      threats.push({
        type: 'AI_GENERATED', category: 'DEEPFAKE', severity: score > 80 ? 'high' : 'medium',
        description: `High probability (${score}%) that this image is AI generated.`
      });
      indicators.push({ keyword: 'AI Generated', type: 'deepfake', highlight: true });
    }

    // Check weapon / drugs / gore
    if (body.weapon > 0.5 || body.gore?.prob > 0.5) {
      riskScore = Math.max(riskScore, 85);
      threats.push({
        type: 'NSFW_CONTENT', category: 'MODERATION', severity: 'critical',
        description: 'Image contains violent or restricted content.'
      });
      indicators.push({ keyword: 'Restricted Content', type: 'moderation', highlight: true });
    }

    return {
      type: 'image',
      riskScore,
      threats, indicators,
      details: {
        fileName: file.originalname,
        source: 'Sightengine API',
        analysisTimestamp: new Date().toISOString()
      }
    };
  }

  _analyzeLocally(file) {
    let threats = [];
    let indicators = [];
    let score = 5;
    const name = (file.originalname || '').toLowerCase();

    // Filename heuristics
    if (name.includes('ai_') || name.includes('generated')) {
      threats.push({ type: 'SUSPICIOUS_FILENAME', category: 'DEEPFAKE', severity: 'medium', description: 'Filename suggests AI-generated content' });
      indicators.push({ keyword: 'Suspicious filename', type: 'metadata', highlight: true });
      score += 30;
    }
    if (name.includes('deepfake') || name.includes('faceswap')) {
      threats.push({ type: 'DEEPFAKE_METADATA', category: 'DEEPFAKE', severity: 'high', description: 'Filename explicitly contains deepfake-related terms' });
      indicators.push({ keyword: 'Deepfake filename', type: 'metadata', highlight: true });
      score += 50;
    }

    // File size heuristic
    const sizeKB = file.size / 1024;
    if (sizeKB < 5) {
      threats.push({ type: 'SUSPICIOUS_SIZE', category: 'DEEPFAKE', severity: 'low', description: 'Image file is unusually small' });
      score += 10;
    }

    return {
      type: 'image', riskScore: Math.min(score, 100), threats, indicators,
      details: { source: 'Heuristics', fileName: file.originalname, fileSizeKB: Math.round(sizeKB) }
    };
  }
}

module.exports = new ImageAnalyzer();
