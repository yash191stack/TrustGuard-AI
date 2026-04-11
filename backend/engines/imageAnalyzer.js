const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const Jimp = require('jimp');
const ExifParser = require('exif-parser');
const preCheckFilter = require('./preCheckFilter');

/**
 * TRUSTGUARD AI — IMAGE FORENSIC SENTINEL (V31)
 * 
 * Purpose: Professional-grade image forensic engine that works locally.
 * Layers:
 * 1. Metadata Forensics (EXIF)
 * 2. Noise Floor Analysis (Sensor vs. Synthetic)
 * 3. Frequency Artifact Detection (Edge anomalies)
 * 4. External API Escalation (Sightengine fallback)
 */
class ImageAnalyzer {
  async analyze(file) {
    if (!file) return { type: 'image', riskScore: 0, threats: [], indicators: [], details: {}, analysisSource: 'none', confidence: 0 };
    
    console.log(`[ImageSentinel] Initiating deep forensic scan: ${file.originalname}`);

    // ─── LAYER 1: METADATA FORENSICS ───────────────────────────
    const metadataResult = this._analyzeMetadata(file);
    
    // ─── LAYER 2: PIXEL FORENSICS (JIMP) ───────────────────────
    let forensicResult = { riskScore: 0, threats: [], indicators: [] };
    try {
        forensicResult = await this._analyzePixels(file);
    } catch (e) {
        console.warn("[ImageSentinel] Pixel analysis failed, continuing with metadata:", e.message);
    }

    // ─── AGGREGATION ──────────────────────────────────────────
    let riskScore = Math.max(metadataResult.riskScore, forensicResult.riskScore);
    const threats = [...metadataResult.threats, ...forensicResult.threats];
    const indicators = [...metadataResult.indicators, ...forensicResult.indicators];

    // ─── LAYER 3: API ESCALATION (Optional) ────────────────────
    if (riskScore > 20 && process.env.SIGHTENGINE_API_SECRET) {
      try {
        console.log(`[ImageSentinel] Suspicious markers found (${riskScore}) — escalating to Sightengine...`);
        const apiRes = await this._analyzeWithSightengine(file);
        // Merge API results if they provide more certainty
        if (apiRes.riskScore > riskScore) {
            riskScore = apiRes.riskScore;
            threats.push(...apiRes.threats);
            indicators.push(...apiRes.indicators);
            return { ...apiRes, analysisSource: 'api', details: { ...apiRes.details, localForensics: forensicResult } };
        }
      } catch (e) {
        console.warn("[ImageSentinel] API escalation failed (likely invalid keys):", e.message);
      }
    }

    // Return Local Forensic Result
    return {
      type: 'image',
      riskScore: Math.min(riskScore, 100),
      threats: this._deduplicate(threats),
      indicators: this._deduplicate(indicators),
      analysisSource: riskScore > 10 ? 'heuristic' : 'pre-check',
      confidence: 45 + Math.min(riskScore / 2, 40),
      details: {
        source: 'TrustGuard Local Forensic Engine',
        metadata: metadataResult.rawExif,
        forensics: forensicResult.metrics,
        fileName: file.originalname,
        fileSizeKB: Math.round(file.size / 1024)
      }
    };
  }

  // ─── INTERNAL: METADATA SCAN ─────────────────────────────────
  _analyzeMetadata(file) {
    let score = 0;
    const threats = [];
    const indicators = [];
    let rawExif = null;

    try {
        const buffer = fs.readFileSync(file.path);
        const parser = ExifParser.create(buffer);
        const result = parser.parse();
        rawExif = result.tags;

        const software = (rawExif.Software || '').toLowerCase();
        const artist = (rawExif.Artist || '').toLowerCase();
        const desc = (rawExif.ImageDescription || '').toLowerCase();
        
        const aiKeywords = ['midjourney', 'dall-e', 'stable diffusion', 'adobe firefly', 'generative', 'ai generated', 'synthetic'];
        
        for (const kw of aiKeywords) {
            if (software.includes(kw) || artist.includes(kw) || desc.includes(kw)) {
                score += 70;
                threats.push({
                    type: 'AI_METADATA_SIGNATURE',
                    category: 'DEEPFAKE',
                    severity: 'high',
                    description: `Image metadata explicitly identifies generative software: "${kw}"`
                });
                indicators.push({ keyword: kw, type: 'metadata', highlight: true });
                break;
            }
        }

        if (!rawExif.Make && !rawExif.Model && !software) {
            score += 15;
            indicators.push({ keyword: 'Stripped Metadata', type: 'metadata', highlight: false });
        }

    } catch (e) { /* Metadata missing or corrupt */ }

    return { riskScore: score, threats, indicators, rawExif };
  }

  // ─── INTERNAL: PIXEL FORENSICS ───────────────────────────────
  async _analyzePixels(file) {
    const image = await Jimp.read(file.path);
    const { width, height } = image.bitmap;
    
    // Sample pixels for noise analysis
    const samples = [];
    const step = Math.max(1, Math.floor(width / 20)); // Sample 20x20 grid
    
    let totalVar = 0;
    let sampleCount = 0;

    for (let x = 0; x < width; x += step) {
        for (let y = 0; y < height; y += step) {
            const color = Jimp.intToRGBA(image.getPixelColor(x, y));
            const brightness = (color.r + color.g + color.b) / 3;
            samples.push(brightness);
        }
    }

    // Calculate Variance
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);

    const threats = [];
    const indicators = [];
    let score = 0;

    // AI images often have unnaturally low sensor noise (standard deviation)
    // Real photos typically have stdDev > 15-20 even in flat areas
    console.log(`[ImageSentinel] StdDev: ${stdDev.toFixed(2)}, Avg Brightness: ${avg.toFixed(2)}`);

    if (stdDev < 4) {
        score += 45;
        threats.push({
            type: 'SYNTHETIC_SMOOTHNESS',
            category: 'DEEPFAKE',
            severity: 'medium',
            description: 'Image lacks standard sensor noise patterns (unnaturally uniform pixels)'
        });
        indicators.push({ keyword: 'Low Noise Floor', type: 'forensic', highlight: true });
    } else if (stdDev < 8) {
        score += 20;
        indicators.push({ keyword: 'Minimal Texture', type: 'forensic', highlight: true });
    }

    // Simple Frequency Check (Laplacian Approximation via local diffs)
    let sharpDiffs = 0;
    for (let i = 1; i < samples.length; i++) {
        if (Math.abs(samples[i] - samples[i-1]) > 50) sharpDiffs++;
    }
    const sharpnessRatio = sharpDiffs / samples.length;

    if (sharpnessRatio > 0.15) {
        score += 15;
        indicators.push({ keyword: 'High Edge Sharpness', type: 'forensic', highlight: false });
    }

    return {
        riskScore: score,
        threats,
        indicators,
        metrics: { stdDev: stdDev.toFixed(2), sharpnessRatio: sharpnessRatio.toFixed(2), brightness: avg.toFixed(2) }
    };
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
      headers: data.getHeaders(),
      timeout: 10000
    });

    const body = response.data;
    let riskScore = 0;
    let threats = [];
    let indicators = [];

    if (body.type && body.type.ai_generated > 0.5) {
      const score = Math.round(body.type.ai_generated * 100);
      riskScore = score;
      threats.push({
        type: 'AI_GENERATED_DETECTED', category: 'DEEPFAKE', severity: score > 80 ? 'high' : 'medium',
        description: `Neural analysis identifies synthetic generation artifacts (${score}%)`
      });
      indicators.push({ keyword: 'AI Model Match', type: 'deepfake', highlight: true });
    }

    return { type: 'image', riskScore, threats, indicators, details: { fileName: file.originalname, apiSource: 'Sightengine' } };
  }

  _deduplicate(arr) {
    const seen = new Set();
    return arr.filter(item => {
      const val = item.keyword || item.type;
      if (seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  }
}

module.exports = new ImageAnalyzer();
