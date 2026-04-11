const axios = require('axios');
const FormData = require('form-data');
const stream = require('stream');

/**
 * TRUSTGUARD AI — BACKEND NEURAL SIGNAL (V6)
 * 
 * Purpose: Lightweight API-based supporting signal for the frontend's
 * local signal-engineering pipeline. Returns raw isReal/confidence.
 * NO aggregation, NO history, NO session management.
 * The frontend handles ALL decision logic.
 */
async function analyze(base64Frame) {
    try {
        const apiUser = process.env.SIGHTENGINE_API_USER;
        const apiSecret = process.env.SIGHTENGINE_API_SECRET;

        if (!apiUser || !apiSecret) {
            // Try HuggingFace as fallback
            return await analyzeWithHF(base64Frame);
        }

        const base64Data = base64Frame.includes('base64,') ? base64Frame.split('base64,')[1] : base64Frame;
        const frameBuffer = Buffer.from(base64Data, 'base64');

        // Skip obviously static/corrupt frames
        if (frameBuffer.length < 500) {
            return { isReal: true, confidence: 0.5, source: 'skip_tiny' };
        }

        const form = new FormData();
        const bufferStream = new stream.PassThrough();
        bufferStream.end(frameBuffer);
        
        form.append('media', bufferStream, { filename: 'frame.jpg', contentType: 'image/jpeg' });
        form.append('models', 'deepfake');
        form.append('api_user', apiUser);
        form.append('api_secret', apiSecret);

        const response = await axios.post('https://api.sightengine.com/1.0/check.json', form, {
            headers: form.getHeaders(),
            timeout: 8000
        });

        const body = response.data;
        const deepfakeScore = body.type?.deepfake || body.deepfake?.prob || 0;

        console.log(`[Sightengine] Deepfake score: ${deepfakeScore.toFixed(3)}`);

        // Return raw signal — frontend decides
        return {
            isReal: deepfakeScore < 0.5,
            confidence: deepfakeScore > 0.5 ? deepfakeScore : (1 - deepfakeScore),
            rawDeepfake: deepfakeScore,
            source: 'sightengine'
        };

    } catch (error) {
        console.error('[Analyzer] Error:', error.response?.data?.error || error.message);
        // On error, try HuggingFace fallback
        try {
            return await analyzeWithHF(base64Frame);
        } catch(e2) {
            // Both failed — return neutral (don't bias toward fake)
            return { isReal: true, confidence: 0.5, source: 'error_neutral' };
        }
    }
}

async function analyzeWithHF(base64Frame) {
    const hfKey = process.env.HF_API_KEY;
    if (!hfKey) return { isReal: true, confidence: 0.5, source: 'no_key' };

    const base64Data = base64Frame.includes('base64,') ? base64Frame.split('base64,')[1] : base64Frame;

    const response = await axios.post(
        "https://router.huggingface.co/hf-inference/models/prithivMLmods/Deep-Fake-Detector-v2-Model",
        { inputs: base64Data },
        {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${hfKey}`
            },
            timeout: 8000
        }
    );

    let data = response.data;
    if (Array.isArray(data) && Array.isArray(data[0])) data = data[0];

    let fakeScore = 0, realScore = 0;
    if (Array.isArray(data)) {
        const f = data.find(d => d.label && d.label.toLowerCase().includes('fake'));
        const r = data.find(d => d.label && d.label.toLowerCase().includes('real'));
        if (f) fakeScore = f.score;
        if (r) realScore = r.score;
    }

    console.log(`[HuggingFace] Real: ${realScore.toFixed(2)}, Fake: ${fakeScore.toFixed(2)}`);

    return {
        isReal: realScore > fakeScore,
        confidence: Math.max(fakeScore, realScore),
        rawDeepfake: fakeScore,
        source: 'huggingface'
    };
}

module.exports = { analyze };
