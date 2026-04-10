const axios = require('axios');
const maliciousDomains = require('../data/phishingDomains.json');
const preCheckFilter = require('./preCheckFilter');

class URLAnalyzer {
  constructor() {
    this.knownBadDomains = maliciousDomains.domains;
    this.phishingKeywords = maliciousDomains.phishingKeywords;
  }

  async analyze(url) {
    if (!url) return { type: 'url', riskScore: 0, threats: [], indicators: [], details: {}, analysisSource: 'none', confidence: 0 };
    
    // Auto-prepend protocol if missing so we can parse it
    let fullUrl = url;
    if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'http://' + fullUrl;

    try {
      const parsedUrl = new URL(fullUrl);
      
      // ─── COST OPTIMIZATION: Pre-check + Tiered Filtering ────
      const preCheck = preCheckFilter.preCheckURL(fullUrl);
      console.log(`[Cost Optimization] URL pre-check: suspicious=${preCheck.suspicious}, score=${preCheck.localScore}`);

      // 1. Run free local heuristic checks first
      const localResult = this._analyzeLocally(fullUrl, parsedUrl, preCheck);
      
      // 2. Only call VirusTotal API if pre-check OR local heuristics flag suspicion
      if (process.env.VIRUSTOTAL_API_KEY && (localResult.riskScore >= 10 || preCheck.suspicious)) {
        console.log(`[Cost Optimization] URL flagged — escalating to VirusTotal API...`);
        const apiResult = await this._analyzeWithVirusTotal(fullUrl, parsedUrl, localResult);
        apiResult.analysisSource = 'api';
        apiResult.confidence = 85 + Math.floor(Math.random() * 10);
        apiResult.details.preCheck = preCheck;
        return apiResult;
      }

      // 3. If safe and VT key missing, return local result
      console.log(`[Cost Optimization] URL appears benign or VT disabled — skipping API call.`);
      localResult.analysisSource = localResult.riskScore > 0 ? 'heuristic' : 'pre-check';
      localResult.confidence = 40 + Math.min(localResult.riskScore, 30);
      localResult.details.preCheck = preCheck;
      localResult.details.costSaved = true;
      return localResult;

    } catch (e) {
      return { type: 'url', riskScore: 0, threats: [{type:'INVALID_URL', description:'Invalid URL format'}], indicators: [], details: {}, analysisSource: 'none', confidence: 10 };
    }
  }

  async _analyzeWithVirusTotal(fullUrl, parsedUrl, localResult = null) {
    try {
        const urlId = Buffer.from(fullUrl).toString('base64').replace(/=/g, '');
        const response = await axios.get(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
            headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }
        });

        const stats = response.data.data.attributes.last_analysis_stats;
        let riskScore = localResult ? localResult.riskScore : 0;
        let threats = localResult ? [...localResult.threats] : [];
        let indicators = localResult ? [...localResult.indicators] : [];

        if (stats.malicious > 0 || stats.suspicious > 0) {
            const vtScore = Math.min(((stats.malicious * 20) + (stats.suspicious * 10)), 100);
            riskScore = Math.max(riskScore, vtScore);
            threats.push({
                type: 'VIRUSTOTAL_FLAGGED',
                category: 'MALWARE/PHISHING',
                severity: riskScore > 60 ? 'critical' : 'high',
                description: `Flagged as malicious by ${stats.malicious} engines and suspicious by ${stats.suspicious} engines.`,
                matches: [fullUrl]
            });
            indicators.push({ keyword: 'Flagged on VT', type: 'reputation', highlight: true });
        }

        return {
            type: 'url',
            riskScore,
            threats,
            indicators,
            details: {
                domain: parsedUrl.hostname,
                protocol: parsedUrl.protocol,
                vtStats: stats,
                source: 'VirusTotal API + Heuristics',
                analysisTimestamp: new Date().toISOString()
            }
        };
    } catch(err) {
        console.warn("VirusTotal check failed, falling back to heuristics.", err.message);
        const fallback = localResult || this._analyzeLocally(fullUrl, parsedUrl);
        fallback.fallbackUsed = true;
        fallback.analysisSource = 'heuristic';
        fallback.confidence = 45;
        return fallback;
    }
  }

  _analyzeLocally(fullUrl, parsedUrl, preCheck = null) {
    const threats = [];
    const indicators = [];
    let score = 0;
    
    if (parsedUrl.protocol === 'http:') {
        threats.push({ type: 'UNSECURE_PROTOCOL', severity: 'low', description: 'Uses HTTP instead of HTTPS' });
        score += 10;
    }

    if (this.knownBadDomains.includes(parsedUrl.hostname)) {
        threats.push({ type: 'KNOWN_MALICIOUS_DOMAIN', severity: 'critical', description: 'Domain is in blocklist' });
        score += 80;
    }

    // Merge pre-check results
    if (preCheck && preCheck.suspicious) {
      score += Math.min(preCheck.localScore / 2, 25); // Add half of pre-check score
      preCheck.reasons.forEach(reason => {
        indicators.push({ keyword: reason, type: 'pre-check', highlight: true });
      });
    }

    // Additional phishing keyword checks
    const hostname = parsedUrl.hostname.toLowerCase();
    for (const kw of this.phishingKeywords || []) {
      if (hostname.includes(kw) && !['google', 'facebook', 'amazon', 'microsoft', 'apple'].some(legit => hostname.endsWith(legit + '.com'))) {
        threats.push({ type: 'PHISHING_KEYWORD', severity: 'medium', description: `Domain contains phishing keyword: "${kw}"` });
        score += 15;
        break;
      }
    }
    
    return { type: 'url', riskScore: Math.min(score, 100), threats, indicators, details: { source: 'Heuristics', domain: parsedUrl.hostname } };
  }
}

module.exports = new URLAnalyzer();
