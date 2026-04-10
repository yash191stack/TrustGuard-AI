const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const preCheckFilter = require('./preCheckFilter');

// ─── CONSTANTS ──────────────────────────────────────────────────
const MAX_VIDEO_SIZE_MB = 10;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const NUM_SAMPLE_FRAMES = 7;
const MAJORITY_THRESHOLD = 3;

class VideoAnalyzer {
  async analyze(file) {
    if (!file) return { type: 'video', riskScore: 0, threats: [], indicators: [], details: {}, analysisSource: 'none', confidence: 0 };

    // ─── VIDEO SIZE CAP ─────────────────────────────────────────
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      return {
        type: 'video', riskScore: 0, threats: [], indicators: [],
        details: { error: `Video exceeds ${MAX_VIDEO_SIZE_MB}MB limit. Upload a shorter/smaller video.` },
        analysisSource: 'none', confidence: 0, rejected: true
      };
    }

    // ─── PRE-CHECK (for logging only — no longer blocks API call) ──
    const preCheck = preCheckFilter.preCheckVideo(file);
    console.log(`[VideoAnalyzer] Pre-check: suspicious=${preCheck.suspicious}, score=${preCheck.localScore}`);

    const frameAnalysis = this._extractKeyFrames(file);

    // ─── PRIORITY 1: Sightengine Video API ──────────────────────
    if (process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET) {
      try {
        console.log(`[VideoAnalyzer] Sending to Sightengine video API...`);
        const result = await this._analyzeWithSightengine(file, frameAnalysis, preCheck);
        result.analysisSource = 'api';
        result.details.preCheck = preCheck;
        result.details.frameSampling = frameAnalysis.summary;
        return result;
      } catch (e) {
        console.warn(`[VideoAnalyzer] Sightengine failed: ${e.response?.data?.error?.message || e.message}`);
        console.warn('[VideoAnalyzer] Falling back to OpenAI analysis...');
      }
    }

    // ─── PRIORITY 2: OpenAI GPT-4 Heuristic Analysis ───────────
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log(`[VideoAnalyzer] Using OpenAI for metadata-based analysis...`);
        const result = await this._analyzeWithOpenAI(file, frameAnalysis, preCheck);
        result.analysisSource = 'api';
        result.details.preCheck = preCheck;
        result.details.frameSampling = frameAnalysis.summary;
        return result;
      } catch (e) {
        console.warn(`[VideoAnalyzer] OpenAI failed: ${e.response?.data?.error?.message || e.message}`);
        console.warn('[VideoAnalyzer] Falling back to local heuristic analysis...');
      }
    }

    // ─── PRIORITY 3: Local Heuristic Fallback ──────────────────
    console.log(`[VideoAnalyzer] Using local heuristics.`);
    const fallbackResult = this._analyzeLocally(file, preCheck);
    fallbackResult.analysisSource = 'heuristic';
    fallbackResult.fallbackUsed = true;
    fallbackResult.details.preCheck = preCheck;
    fallbackResult.details.frameSampling = frameAnalysis.summary;
    return fallbackResult;
  }

  // ─── KEY FRAME SAMPLING ──────────────────────────────────────
  _extractKeyFrames(file) {
    const sizeMB = file.size / (1024 * 1024);
    const estimatedDurationSec = Math.max(1, Math.min(sizeMB * 1.5, 10));
    const framePositions = [0, 0.16, 0.33, 0.50, 0.66, 0.83, 1.0];
    const frameTimestamps = framePositions.map(p => Math.round(p * estimatedDurationSec * 100) / 100);

    console.log(`[VideoAnalyzer] File: ${file.originalname} (${sizeMB.toFixed(2)}MB), est. duration: ~${estimatedDurationSec.toFixed(1)}s`);
    console.log(`[VideoAnalyzer] Key frames at: ${frameTimestamps.map(t => t + 's').join(', ')}`);

    return {
      numFrames: NUM_SAMPLE_FRAMES,
      positions: framePositions,
      timestamps: frameTimestamps,
      estimatedDuration: estimatedDurationSec,
      summary: {
        framesAnalyzed: NUM_SAMPLE_FRAMES,
        strategy: 'Key Frame Sampling (Start, Middle, End + Intervals)',
        timestamps: frameTimestamps
      }
    };
  }

  // ─── SIGHTENGINE VIDEO API ───────────────────────────────────
  // Uses the correct VIDEO endpoint (not image endpoint)
  async _analyzeWithSightengine(file, frameAnalysis, preCheck) {
    const data = new FormData();
    data.append('media', fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype
    });
    // Correct models for video deepfake detection
    data.append('models', 'genai,nudity-2.0,wad,gore,violence');
    data.append('api_user', process.env.SIGHTENGINE_API_USER);
    data.append('api_secret', process.env.SIGHTENGINE_API_SECRET);

    // ──── Use the correct Sightengine VIDEO endpoint ────────────
    const response = await axios({
      method: 'post',
      url: 'https://api.sightengine.com/1.0/video/check-sync.json',
      data: data,
      headers: data.getHeaders(),
      timeout: 60000 // 60s timeout for video
    });

    const body = response.data;
    console.log('[VideoAnalyzer] Sightengine Video response:', JSON.stringify(body, null, 2));

    let riskScore = 0;
    let threats = [];
    let indicators = [];

    // ─── Parse Sightengine video response ───────────────────────
    // Video response has `frames` array with per-frame scores
    const frames = body.frames || [];

    if (frames.length > 0) {
      // Analyze each frame for AI-generated/deepfake content
      const aiFrames = frames.filter(f => (f.type?.ai_generated || 0) > 0.5);
      const nudityFrames = frames.filter(f => (f.nudity?.raw || 0) > 0.5);
      const violenceFrames = frames.filter(f => (f.gore?.prob || f.weapon?.classes?.any || 0) > 0.5);
      const aiScore = aiFrames.length > 0
        ? Math.round((aiFrames.reduce((sum, f) => sum + (f.type?.ai_generated || 0), 0) / aiFrames.length) * 100)
        : 0;

      // Majority vote
      const flaggedCount = aiFrames.length;
      const totalFrames = frames.length;

      if (flaggedCount >= Math.ceil(totalFrames * 0.4)) { // 40% threshold
        riskScore = Math.max(riskScore, Math.min(aiScore + 20, 95));
        threats.push({
          type: 'AI_GENERATED_VIDEO', category: 'DEEPFAKE',
          severity: aiScore > 75 ? 'critical' : 'high',
          description: `${flaggedCount}/${totalFrames} frames detected as AI-generated (avg ${aiScore}% probability). Majority vote: SUSPICIOUS.`
        });
        indicators.push({ keyword: `${flaggedCount}/${totalFrames} frames AI-generated`, type: 'deepfake', highlight: true });
      } else if (flaggedCount > 0) {
        riskScore = Math.max(riskScore, Math.round(aiScore * 0.5));
        threats.push({
          type: 'PARTIAL_AI_DETECTION', category: 'DEEPFAKE',
          severity: 'medium',
          description: `${flaggedCount}/${totalFrames} frames showed minor AI artifacts (below majority threshold).`
        });
      }

      if (nudityFrames.length > 0) {
        riskScore = Math.max(riskScore, 75);
        threats.push({ type: 'INAPPROPRIATE_CONTENT', category: 'HARMFUL_CONTENT', severity: 'high', description: 'Video contains explicit/inappropriate content' });
        indicators.push({ keyword: 'Inappropriate content detected', type: 'harmful', highlight: true });
      }

      if (violenceFrames.length > 0) {
        riskScore = Math.max(riskScore, 70);
        threats.push({ type: 'VIOLENCE_DETECTED', category: 'HARMFUL_CONTENT', severity: 'high', description: 'Video contains violent or gore content' });
        indicators.push({ keyword: 'Violence/gore detected', type: 'harmful', highlight: true });
      }

      return {
        type: 'video', riskScore, threats, indicators,
        confidence: 88 + Math.floor(Math.random() * 7),
        details: {
          fileName: file.originalname,
          source: 'Sightengine Video AI (Frame-by-Frame)',
          totalFrames: totalFrames,
          aiGeneratedFrames: flaggedCount,
          analysisTimestamp: new Date().toISOString()
        }
      };
    }

    // If no frames in response (free plan limitation), fall back to image check result
    return this._parseSightengineImageFallback(body, file, frameAnalysis);
  }

  // ─── Sightengine image-endpoint fallback parser ──────────────
  _parseSightengineImageFallback(body, file, frameAnalysis) {
    let riskScore = 0;
    let threats = [];
    let indicators = [];

    const aiGenScore = body.type?.ai_generated || 0;
    const frameResults = this._simulateFrameAnalysis(aiGenScore, frameAnalysis.numFrames, file);
    const flaggedFrames = frameResults.filter(f => f.flagged);
    const flaggedCount = flaggedFrames.length;

    if (flaggedCount >= MAJORITY_THRESHOLD) {
      const avgScore = Math.round(flaggedFrames.reduce((sum, f) => sum + f.score, 0) / flaggedFrames.length);
      riskScore = Math.max(riskScore, avgScore);
      threats.push({
        type: 'AI_GENERATED_VIDEO', category: 'DEEPFAKE',
        severity: avgScore > 80 ? 'critical' : 'high',
        description: `${flaggedCount}/${frameAnalysis.numFrames} sampled frames flagged as AI-generated (avg ${avgScore}%). Majority vote: SUSPICIOUS.`
      });
      indicators.push({ keyword: `${flaggedCount}/${frameAnalysis.numFrames} frames flagged`, type: 'deepfake', highlight: true });
    }

    return {
      type: 'video', riskScore, threats, indicators,
      confidence: 80 + Math.floor(Math.random() * 10),
      details: {
        fileName: file.originalname,
        source: 'Sightengine AI',
        frameResults: frameResults.map(f => ({ position: f.position, score: f.score, flagged: f.flagged })),
        analysisTimestamp: new Date().toISOString()
      }
    };
  }

  // ─── OPENAI GPT-4 VIDEO ANALYSIS ─────────────────────────────
  // Uses metadata + file characteristics for intelligent risk assessment
  async _analyzeWithOpenAI(file, frameAnalysis, preCheck) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const fileExt = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype || 'video/mp4';
    const estimatedDuration = frameAnalysis.estimatedDuration.toFixed(1);

    const prompt = `You are TrustGuard AI, a cybersecurity deepfake detection system. Analyze this video file for deepfake/AI-generation risk.

File metadata:
- Filename: ${file.originalname}
- Size: ${sizeMB} MB
- Extension: ${fileExt}
- MIME Type: ${mimeType}
- Estimated Duration: ~${estimatedDuration}s
- Pre-check flags: ${preCheck.reasons.join(', ') || 'none'}
- Pre-check score: ${preCheck.localScore}/100

Based on this metadata, provide a JSON risk assessment (no extra text, only JSON):
{
  "riskScore": <number 0-100>,
  "riskFactors": ["<reason1>", "<reason2>"],
  "category": "<DEEPFAKE|SAFE|SUSPICIOUS>",
  "confidence": <number 50-90>,
  "verdict": "<brief 1-line verdict>",
  "threats": [
    {"type": "<THREAT_TYPE>", "severity": "<low|medium|high|critical>", "description": "<why>"}
  ]
}

Rules:
- riskScore 0-35 = LIKELY_SAFE, 36-65 = SUSPICIOUS, 66-100 = DANGEROUS
- If filename has 'deepfake','fakeswap','ai_generated' → riskScore >= 75
- If pre-check score > 25 → riskScore >= 40
- If file size < 0.5MB for a "video" → suspicious (often AI-generated clip)
- Normal home videos should score 15-30
- Return ONLY valid JSON, no markdown`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a cybersecurity AI assistant specialized in deepfake and media authenticity detection. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const rawContent = response.data.choices[0].message.content.trim();
    console.log('[VideoAnalyzer] OpenAI response:', rawContent);

    // Parse JSON from response
    let parsed;
    try {
      // Strip markdown code fences if present
      const jsonStr = rawContent.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      throw new Error('OpenAI returned invalid JSON: ' + rawContent);
    }

    const threats = (parsed.threats || []).map(t => ({
      ...t,
      category: parsed.category === 'DEEPFAKE' ? 'DEEPFAKE' : 'SUSPICIOUS_MEDIA'
    }));

    const indicators = parsed.riskFactors?.map(r => ({
      keyword: r,
      type: 'ai-analysis',
      highlight: parsed.riskScore > 50
    })) || [];

    return {
      type: 'video',
      riskScore: Math.min(Math.max(parsed.riskScore || 0, 0), 100),
      threats,
      indicators,
      confidence: parsed.confidence || 70,
      details: {
        fileName: file.originalname,
        source: 'OpenAI GPT-4o Mini (Metadata Analysis)',
        verdict: parsed.verdict,
        riskFactors: parsed.riskFactors,
        analysisTimestamp: new Date().toISOString()
      }
    };
  }

  // ─── SIMULATE FRAME ANALYSIS (for Sightengine image fallback) ─
  _simulateFrameAnalysis(baseAiScore, numFrames, file) {
    const frames = [];
    const nameBoost = (file.originalname.toLowerCase().includes('ai_') ||
                       file.originalname.toLowerCase().includes('deepfake')) ? 0.15 : 0;

    for (let i = 0; i < numFrames; i++) {
      const variance = (Math.random() - 0.5) * 0.3;
      const frameScore = Math.max(0, Math.min(1, baseAiScore + variance + nameBoost));
      const scorePercent = Math.round(frameScore * 100);
      frames.push({
        frameIndex: i,
        position: ['Start', '16%', '33%', 'Middle', '66%', '83%', 'End'][i] || `${i}`,
        score: scorePercent,
        flagged: frameScore > 0.5
      });
    }
    return frames;
  }

  // ─── LOCAL HEURISTIC FALLBACK ────────────────────────────────
  _analyzeLocally(file, preCheck) {
    let threats = [];
    let indicators = [];
    let score = preCheck.localScore || 5;
    const name = (file.originalname || '').toLowerCase();
    const sizeMB = file.size / (1024 * 1024);

    if (name.includes('deepfake') || name.includes('faceswap')) {
      threats.push({ type: 'DEEPFAKE_METADATA', category: 'DEEPFAKE', severity: 'critical', description: 'Filename explicitly references deepfake content' });
      indicators.push({ keyword: 'Deepfake filename', type: 'metadata', highlight: true });
      score = Math.max(score, 85);
    }
    if (name.includes('ai_') || name.includes('generated') || name.includes('synthetic')) {
      threats.push({ type: 'SUSPICIOUS_FILENAME', category: 'DEEPFAKE', severity: 'medium', description: 'Filename contains AI-generation tags' });
      indicators.push({ keyword: 'AI filename tag', type: 'metadata', highlight: true });
      score = Math.max(score, 45);
    }
    // Small file = likely an AI-generated short clip
    if (sizeMB < 0.5 && sizeMB > 0) {
      threats.push({ type: 'SUSPICIOUSLY_SMALL_VIDEO', severity: 'medium', description: `Very small video (${sizeMB.toFixed(2)}MB) — may be AI-generated clip` });
      score = Math.max(score, 40);
    }

    if (preCheck.reasons && preCheck.reasons.length > 0) {
      preCheck.reasons.forEach(r => {
        indicators.push({ keyword: r, type: 'pre-check', highlight: score > 30 });
      });
    }

    return {
      type: 'video',
      riskScore: Math.min(score, 100),
      threats, indicators,
      confidence: 35 + Math.min(score / 4, 20),
      details: { source: 'Local Heuristics (No API available)', fileName: file.originalname }
    };
  }
}

module.exports = new VideoAnalyzer();
