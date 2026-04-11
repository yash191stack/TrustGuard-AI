const axios = require('axios');
const FormData = require('form-data');
const stream = require('stream');

const sessionVault = {};

/**
 * TRUSTGUARD AI - NEURAL SENTINEL (V5) 
 * UPGRADED TO SIGHTENGINE PRODUCTION ENGINE
 */
async function analyze(base64Frame, clientId = 'unknown') {
    try {
        const apiUser = process.env.SIGHTENGINE_API_USER;
        const apiSecret = process.env.SIGHTENGINE_API_SECRET;

        if (!apiUser || !apiSecret) {
            throw new Error("Missing_Sightengine_Credentials");
        }

        if (!sessionVault[clientId]) {
            sessionVault[clientId] = {
                history: [],
                lastHash: '',
                lastUpdated: Date.now()
            };
        }
        
        const session = sessionVault[clientId];
        session.lastUpdated = Date.now();

        const base64Data = base64Frame.includes('base64,') ? base64Frame.split('base64,')[1] : base64Frame;
        const frameBuffer = Buffer.from(base64Data, 'base64');

        // LOCAL: ANTI-POISONING
        const currentHash = frameBuffer.slice(0, 40).toString('hex');
        const isStatic = currentHash === session.lastHash;
        session.lastHash = currentHash;

        if (isStatic) {
            return aggregateAndReturn(clientId, { isReal: true, confidence: 0.99, source: 'static_filter' });
        }

        // ─── SIGHTENGINE NEURAL CALL ───
        console.log(`[Sightengine] Processing frame for client: ${clientId}`);
        
        const form = new FormData();
        const bufferStream = new stream.PassThrough();
        bufferStream.end(frameBuffer);
        
        form.append('media', bufferStream, { filename: 'frame.jpg', contentType: 'image/jpeg' });
        form.append('models', 'deepfake,face');
        form.append('api_user', apiUser);
        form.append('api_secret', apiSecret);

        const response = await axios.post('https://api.sightengine.com/1.0/check.json', form, {
            headers: form.getHeaders(),
            timeout: 10000
        });

        const body = response.data;
        
        // Sightengine 'deepfake' score (0 to 1)
        const deepfakeScore = body.type?.deepfake || body.deepfake?.prob || 0;
        const faceDetected = body.faces && body.faces.length > 0;

        console.log(`[Engine] Result: Deepfake=${deepfakeScore.toFixed(3)}, FaceFound=${faceDetected}`);

        // STRATEGIC TRUTH:
        // A human is "Dangerous" if deepfake score > 0.65
        const isActuallyFake = deepfakeScore > 0.65;

        return aggregateAndReturn(clientId, {
            isReal: !isActuallyFake,
            confidence: isActuallyFake ? deepfakeScore : (1 - deepfakeScore),
            details: isActuallyFake ? 'Neural artifacts found' : 'Texture verified'
        });

    } catch (error) {
        console.error('[Engine] Neural Error:', error.response?.data || error.message);
        // Fallback to safe mode only on error
        return { isError: true, isReal: true, confidence: 0.5 };
    }
}

function aggregateAndReturn(clientId, newFrame) {
    const session = sessionVault[clientId];
    
    // Recovery Logic: Flush on clean hit
    if (newFrame.isReal && newFrame.confidence > 0.8) {
        session.history = [];
    }

    session.history.push(newFrame);
    if (session.history.length > 5) session.history.shift();

    const history = session.history;
    const fakeVotes = history.filter(f => !f.isReal).length;
    const avgConf = history.reduce((s, f) => s + f.confidence, 0) / (history.length || 1);

    // Final Logic: Need majority of small window to trigger FAKE
    const isAlert = fakeVotes >= 2 && avgConf > 0.6;

    return {
        isReal: !isAlert,
        confidence: avgConf,
        details: isAlert ? 'Persistent deepfake pattern detected.' : 'Temporal biometric stability confirmed.',
        stats: {
            fakeVotes,
            avgConf: Math.round(avgConf * 100)
        }
    };
}

setInterval(() => {
    const now = Date.now();
    Object.keys(sessionVault).forEach(id => {
        if (now - sessionVault[id].lastUpdated > 300000) delete sessionVault[id];
    });
}, 60000);

module.exports = { analyze };
