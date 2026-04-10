const axios = require('axios');
const scamPatterns = require('../data/scamPatterns.json');

class TextAnalyzer {
  constructor() {
    this.patterns = scamPatterns;
    this.compiledRegex = this.patterns.suspiciousPatterns.map(p => new RegExp(p, 'gi'));
  }

  async analyze(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return {
        type: 'text', riskScore: 0, threats: [], indicators: [],
        details: { message: 'No text provided for analysis' }
      };
    }

    try {
      // 1. Try OpenAI if API key exists
      if (process.env.OPENAI_API_KEY) {
        return await this._analyzeWithOpenAI(text);
      }
    } catch (error) {
      console.warn("OpenAI API failed, falling back to local heuristic analysis.", error.message);
    }

    // 2. Fallback to Local Heuristics
    return this._analyzeLocally(text);
  }

  async _analyzeWithOpenAI(text) {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: `You are a cybersecurity expert analyzing a message for threats like scams, phishing, manipulation, or fake urgency.
Return a JSON object strictly matching this schema:
{
  "riskScore": (0 to 100),
  "threats": [{"type": "threat type (e.g. SCAM)", "category": "category name", "severity": "low/medium/high/critical", "description": "detailed reason"}],
  "indicators": [{"keyword": "suspicious word or phrase", "type": "urgency/financial/etc", "highlight": true}]
}`
        }, {
          role: 'user', content: text
        }],
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResult = JSON.parse(response.data.choices[0].message.content);
    return {
      type: 'text',
      riskScore: aiResult.riskScore || 0,
      threats: aiResult.threats || [],
      indicators: aiResult.indicators || [],
      details: {
        textLength: text.length,
        wordCount: text.split(/\\s+/).length,
        languageHints: this._detectLanguage(text),
        analysisTimestamp: new Date().toISOString(),
        source: 'OpenAI Deep Analysis'
      }
    };
  }

  _analyzeLocally(text) {
    const normalizedText = text.toLowerCase().trim();
    const threats = [];
    const indicators = [];
    let totalWeight = 0;

    const urgencyResult = this._detectUrgency(normalizedText);
    if (urgencyResult.found) {
      threats.push({ type: 'URGENCY_MANIPULATION', category: 'SOCIAL_ENGINEERING', severity: 'medium', description: 'Message creates artificial urgency', matches: urgencyResult.matches });
      indicators.push(...urgencyResult.matches.map(m => ({ keyword: m, type: 'urgency', highlight: true })));
      totalWeight += urgencyResult.score;
    }

    const financialResult = this._detectFinancial(normalizedText);
    if (financialResult.found) {
      threats.push({ type: 'FINANCIAL_SCAM', category: 'SCAM', severity: 'high', description: 'Financial requests or references', matches: financialResult.matches });
      indicators.push(...financialResult.matches.map(m => ({ keyword: m, type: 'financial', highlight: true })));
      totalWeight += financialResult.score;
    }

    const impersonationResult = this._detectImpersonation(normalizedText);
    if (impersonationResult.found) {
      threats.push({ type: 'IMPERSONATION', category: 'IMPERSONATION', severity: 'high', description: 'Impersonates an authority or entity', matches: impersonationResult.matches });
      indicators.push(...impersonationResult.matches.map(m => ({ keyword: m, type: 'impersonation', highlight: true })));
      totalWeight += impersonationResult.score;
    }
    
    return {
      type: 'text',
      riskScore: Math.min(Math.round(totalWeight), 100),
      threats, indicators,
      details: {
        textLength: text.length,
        wordCount: text.split(/\\s+/).length,
        languageHints: this._detectLanguage(normalizedText),
        analysisTimestamp: new Date().toISOString(),
        source: 'Heuristic Engine'
      }
    };
  }

  _detectUrgency(text) {
    const allKeywords = [...this.patterns.urgencyKeywords.en, ...this.patterns.urgencyKeywords.hi];
    const matches = allKeywords.filter(kw => text.includes(kw));
    return { found: matches.length > 0, matches, score: Math.min(matches.length * 12, 35) };
  }

  _detectFinancial(text) {
    const allKeywords = [...this.patterns.financialKeywords.en, ...this.patterns.financialKeywords.hi];
    const matches = allKeywords.filter(kw => text.includes(kw));
    return { found: matches.length > 0, matches, score: Math.min(matches.length * 15, 40) };
  }

  _detectImpersonation(text) {
    const allKeywords = [...this.patterns.impersonationKeywords.en, ...this.patterns.impersonationKeywords.hi];
    const matches = allKeywords.filter(kw => text.includes(kw));
    return { found: matches.length > 0, matches, score: Math.min(matches.length * 14, 35) };
  }

  _detectLanguage(text) {
    const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
    let languages = ['English'];
    if (hindiChars > 0) languages.push('Hindi');
    return languages;
  }
}

module.exports = new TextAnalyzer();
