const axios = require('axios');

async function analyze(base64Frame) {
    try {
        console.log('[Live Deepfake] Sending high-res JSON frame to HF AI Engine...');
        const hfKey = process.env.HF_API_KEY;

        if (!hfKey) {
            throw new Error("Missing_HF_Key");
        }

        const base64Data = base64Frame.includes('base64,') ? base64Frame.split('base64,')[1] : base64Frame;

        // HuggingFace Inference API expects perfectly formatted JSON for vision models
        // Using axios is stable for JSON JSON.stringify payloads
        const response = await axios.post(
            "https://router.huggingface.co/hf-inference/models/prithivMLmods/Deep-Fake-Detector-v2-Model",
            { inputs: base64Data },
            {
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${hfKey}`
                }
            }
        );

        let data = response.data;
        if (Array.isArray(data) && Array.isArray(data[0])) {
            data = data[0]; 
        }

        let isReal = true;
        let confidence = 0.99;
        let fakeScore = 0;

        if (Array.isArray(data)) {
            const fakeLabel = data.find(d => d.label && d.label.toLowerCase().includes('fake'));
            if (fakeLabel) fakeScore = fakeLabel.score;
        }

        isReal = fakeScore < 0.5;
        confidence = isReal ? (1 - fakeScore) : fakeScore;

        return {
            isReal: isReal,
            confidence: confidence,
            details: isReal 
                ? 'Face verified as authentic via neural analysis.' 
                : 'Generative ML patterns or deepfake artifacts detected by the model.',
            notice: 'Analyzed via HuggingFace Deepfake Classifier (Real AI)'
        };

    } catch (error) {
        if (error.message === "Missing_HF_Key") {
             return {
                isError: true,
                isReal: false,
                confidence: 0,
                details: 'MISSING HUGGINGFACE API KEY!',
                notice: 'Add HF_API_KEY in .env to get true ML data.'
            };
        }

        console.error('[Live Deepfake] ML Error:', error.response?.data || error.message);
        
        let errData = error.response?.data;
        if (typeof errData === 'string' && errData.includes('<html')) {
            errData = { error: 'Network WAF blocked request. Please wait 10s.' };
        }

        if (errData && errData.error && errData.error.includes('loading')) {
            return {
                isError: true,
                isReal: false,
                confidence: 0,
                details: `Waking up AI model Server. ETA: ${Math.round(errData.estimated_time || 20)} seconds.`,
                notice: 'Connecting to HuggingFace Datacenter...'
            };
        }

        return {
            isError: true,
            isReal: false,
            confidence: 0,
            details: `API Error: ${errData?.error || error.message}. Retrying...`,
            notice: 'Network unstable or model timeout.'
        };
    }
}

module.exports = { analyze };
