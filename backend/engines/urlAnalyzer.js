const axios = require('axios');
const maliciousDomains = require('../data/phishingDomains.json');

class URLAnalyzer {
  constructor() {
    this.knownBadDomains = maliciousDomains.domains;
    this.phishingKeywords = maliciousDomains.phishingKeywords;
  }

  async analyze(url) {
    if (!url) return { type: 'url', riskScore: 0, threats: [], indicators: [], details: {} };
    
    // Auto-prepend protocol if missing so we can parse it
    let fullUrl = url;
    if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'http://' + fullUrl;

    try {
      const parsedUrl = new URL(fullUrl);
      
      // COST OPTIMIZATION: Tiered Filtering System
      // 1. Run free local heuristic checks first
      const localResult = this._analyzeLocally(fullUrl, parsedUrl);
      
      // 2. Only call expensive API (VirusTotal) if early heuristics show suspicion
      if (process.env.VIRUSTOTAL_API_KEY && (localResult.riskScore >= 10 || localResult.threats.length > 0)) {
        console.log(`[Cost Optimization] Suspicious URL detected locally (${localResult.riskScore} risk), escalating to VirusTotal API...`);
        return await this._analyzeWithVirusTotal(fullUrl, parsedUrl, localResult);
      }

      // 3. If it looks perfectly safe or VT key is absent, return local result immediately to save cost API calls
      console.log(`[Cost Optimization] URL seems benign or VT disabled, skipping API call to save resources.`);
      return localResult;

    } catch (e) {
      return { type: 'url', riskScore: 0, threats: [{type:'INVALID_URL', description:'Invalid URL format'}], indicators: [], details: {} };
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
            riskScore = Math.max(riskScore, vtScore); // take the max of local or VT score
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
        return localResult || this._analyzeLocally(fullUrl, parsedUrl);
    }
  }

  _analyzeLocally(fullUrl, parsedUrl) {
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
    
    return { type: 'url', riskScore: score, threats, indicators, details: { source: 'Heuristics' } };
  }
}

module.exports = new URLAnalyzer();
