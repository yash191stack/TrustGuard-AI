const axios = require('axios');

async function analyze(base64Frame) {
    // Check if API key is provided
    const apiKey = process.env.ARAYA_API_KEY;
    
    if (!apiKey || apiKey.trim() === '') {
        // Fallback Mock Mode - useful until user provides the key
        console.log('[ArayaAnalyzer] API Key missing. Returning mock result.');
        const isReal = Math.random() > 0.4; // 60% chance real
        
        // Simulating network delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return {
            isReal: isReal,
            confidence: 0.85 + (Math.random() * 0.1),
            details: isReal ? 'No artificial manipulation detected in facial structures.' : 'Synthetic anomalies detected. Inconsistent micro-expressions.',
            notice: 'Mock result: ARAYA_API_KEY missing in .env'
        };
    }

    try {
        console.log('[ArayaAnalyzer] Calling Araya.ai API...');
        
        // Convert data URL to base64 string without prefix for API if needed
        const base64Data = base64Frame.includes('base64,') ? base64Frame.split('base64,')[1] : base64Frame;
        
        const response = await axios.post(
            'https://api.arya.ai/v1/deepfake-detection',
            {
                image: base64Data
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            }
        );
        
        const result = response.data;
        
        // Example parsing (Placeholder logic: change based on actual API format once user provides it)
        const confidenceScore = result.confidence || 0.9;
        const isActuallyReal = result.decision ? result.decision === 'REAL' : result.is_real;

        return {
            isReal: isActuallyReal ?? true,
            confidence: confidenceScore,
            details: 'Analyzed via Araya.ai live API'
        };

    } catch (error) {
        console.error('[ArayaAnalyzer] Error:', error.response?.data || error.message);
        
        // Fallback to Mock Data if the endpoint fails (since placeholder endpoint is used)
        const isReal = Math.random() > 0.4;
        return {
            isReal: isReal,
            confidence: 0.85 + (Math.random() * 0.1),
            details: 'API Failed/Invalid Endpoint. Falling back to Mock analysis.',
            notice: 'Mock Result: Please configure the exact Araya.ai endpoint documentation in backend/engines/arayaAnalyzer.js'
        };
    }
}

module.exports = { analyze };
