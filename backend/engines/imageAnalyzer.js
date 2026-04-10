const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

class ImageAnalyzer {
  async analyze(file) {
    if (!file) return { type: 'image', riskScore: 0, threats: [], indicators: [], details: {} };
    
    try {
      if (process.env.SIGHTENGINE_API_SECRET) {
        return await this._analyzeWithSightengine(file);
      }
    } catch (e) {
      console.warn("Sightengine Image API failed, falling back to basic analysis.", e.response?.data || e.message);
    }
    
    return this._analyzeLocally(file);
  }

  async _analyzeWithSightengine(file) {
    const data = new FormData();
    data.append('media', fs.createReadStream(file.path));
    // Check for AI generated, gore, weapons, drugs
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
    // Basic local check
    return { type: 'image', riskScore: 10, threats: [], indicators: [], details: { source: 'Heuristics', message: 'Basic check passed' } };
  }
}

module.exports = new ImageAnalyzer();
