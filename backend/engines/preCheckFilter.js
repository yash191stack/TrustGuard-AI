/**
 * PreCheck Filter — Rule-based Pre-check Layer
 * 
 * Cost Optimization: Runs fast, free local checks BEFORE calling expensive APIs.
 * If input is NOT suspicious, we skip the API call entirely.
 */

const scamPatterns = require('../data/scamPatterns.json');

class PreCheckFilter {
  constructor() {
    this.patterns = scamPatterns;
    this.compiledRegex = this.patterns.suspiciousPatterns.map(p => new RegExp(p, 'gi'));

    // Suspicious URL patterns
    this.suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.pw', '.cc', '.buzz', '.work', '.click'];
    this.ipUrlRegex = /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i;
    this.excessiveSubdomainRegex = /^https?:\/\/([^/]+\.){4,}/i;
    this.atInPathRegex = /^https?:\/\/[^/]*@/i;
    this.homoglyphRegex = /[а-яА-Я]|xn--/i; // Cyrillic or punycode internationalized domains
    this.shortenerDomains = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'rebrand.ly', 'cutt.ly', 'shorturl.at'];

    // Suspicious filename keywords for media files
    this.suspiciousMediaKeywords = ['ai_', 'deepfake', 'faceswap', 'generated', 'clone', 'synthetic', 'fake', 'swap'];
  }

  // ─── TEXT PRE-CHECK ───────────────────────────────────────────
  preCheckText(text) {
    if (!text || typeof text !== 'string') {
      return { suspicious: false, localScore: 0, reasons: [] };
    }

    const normalized = text.toLowerCase().trim();
    const reasons = [];
    let score = 0;

    // 1. Regex pattern matching
    let regexHits = 0;
    for (const regex of this.compiledRegex) {
      regex.lastIndex = 0; // Reset regex state
      if (regex.test(normalized)) {
        regexHits++;
      }
    }
    if (regexHits > 0) {
      score += Math.min(regexHits * 15, 45);
      reasons.push(`Matched ${regexHits} suspicious regex pattern(s)`);
    }

    // 2. Keyword density check
    const allKeywords = [
      ...this.patterns.urgencyKeywords.en,
      ...this.patterns.urgencyKeywords.hi,
      ...this.patterns.financialKeywords.en,
      ...this.patterns.financialKeywords.hi,
      ...this.patterns.impersonationKeywords.en,
      ...this.patterns.impersonationKeywords.hi,
      ...(this.patterns.threatKeywords?.en || []),
      ...(this.patterns.threatKeywords?.hi || []),
      ...(this.patterns.rewardKeywords?.en || []),
      ...(this.patterns.rewardKeywords?.hi || [])
    ];

    const keywordHits = allKeywords.filter(kw => normalized.includes(kw));
    if (keywordHits.length >= 3) {
      score += Math.min(keywordHits.length * 8, 35);
      reasons.push(`Found ${keywordHits.length} suspicious keywords`);
    }

    // 3. Manipulation phrases
    const manipHits = this.patterns.manipulationPhrases.filter(p => normalized.includes(p));
    if (manipHits.length > 0) {
      score += Math.min(manipHits.length * 12, 30);
      reasons.push(`Detected ${manipHits.length} manipulation phrase(s)`);
    }

    // 4. Contains URLs in text → extra suspicion
    const urlInText = normalized.match(/https?:\/\/\S+/gi);
    if (urlInText && urlInText.length > 0) {
      score += 10;
      reasons.push('Text contains embedded URL(s)');
    }

    return {
      suspicious: score >= 15,
      localScore: Math.min(score, 100),
      reasons
    };
  }

  // ─── URL PRE-CHECK ────────────────────────────────────────────
  preCheckURL(url) {
    if (!url || typeof url !== 'string') {
      return { suspicious: false, localScore: 0, reasons: [] };
    }

    const normalized = url.toLowerCase().trim();
    const reasons = [];
    let score = 0;

    // 1. IP address URL
    if (this.ipUrlRegex.test(normalized)) {
      score += 30;
      reasons.push('URL uses raw IP address instead of domain');
    }

    // 2. Suspicious TLD
    for (const tld of this.suspiciousTLDs) {
      if (normalized.includes(tld)) {
        score += 20;
        reasons.push(`Uses suspicious TLD: ${tld}`);
        break;
      }
    }

    // 3. Excessive subdomains
    if (this.excessiveSubdomainRegex.test(normalized)) {
      score += 25;
      reasons.push('Excessive subdomains detected (possible phishing)');
    }

    // 4. @ in URL path
    if (this.atInPathRegex.test(normalized)) {
      score += 35;
      reasons.push('URL contains @ symbol (credential-based redirection)');
    }

    // 5. Homoglyph / punycode
    if (this.homoglyphRegex.test(normalized)) {
      score += 30;
      reasons.push('URL contains homoglyph or punycode characters');
    }

    // 6. URL shortener
    for (const shortener of this.shortenerDomains) {
      if (normalized.includes(shortener)) {
        score += 15;
        reasons.push(`URL uses shortener service: ${shortener}`);
        break;
      }
    }

    // 7. HTTP instead of HTTPS
    if (normalized.startsWith('http://')) {
      score += 10;
      reasons.push('Uses insecure HTTP protocol');
    }

    // 8. Double dots in domain
    try {
      const parsed = new URL(normalized.startsWith('http') ? normalized : 'http://' + normalized);
      if (parsed.hostname.includes('..')) {
        score += 20;
        reasons.push('Domain contains double-dots');
      }
      // Very long hostname
      if (parsed.hostname.length > 50) {
        score += 15;
        reasons.push('Unusually long domain name');
      }
    } catch (e) { /* invalid URL, will be caught downstream */ }

    return {
      suspicious: score >= 10,
      localScore: Math.min(score, 100),
      reasons
    };
  }

  // ─── IMAGE PRE-CHECK ──────────────────────────────────────────
  preCheckImage(file) {
    if (!file) return { suspicious: false, localScore: 0, reasons: [] };

    const reasons = [];
    let score = 0;
    const name = (file.originalname || '').toLowerCase();
    const sizeKB = file.size / 1024;

    // 1. Suspicious filename
    for (const keyword of this.suspiciousMediaKeywords) {
      if (name.includes(keyword)) {
        score += 25;
        reasons.push(`Filename contains suspicious keyword: "${keyword}"`);
      }
    }

    // 2. Unusually small image (likely placeholder or generated thumbnail)
    if (sizeKB < 5) {
      score += 15;
      reasons.push('Image file is unusually small (< 5KB)');
    }

    // 3. File extension mismatch with MIME
    const ext = name.split('.').pop();
    const mimeExt = (file.mimetype || '').split('/').pop();
    if (ext && mimeExt && !mimeExt.includes(ext) && ext !== 'jpg' || (ext === 'jpg' && mimeExt !== 'jpeg' && mimeExt !== 'jpg')) {
      // Flexible check — only flag clear mismatches
      if (!['jpg', 'jpeg'].includes(ext) || !['jpg', 'jpeg'].includes(mimeExt)) {
        if (ext !== mimeExt && !mimeExt.includes(ext)) {
          score += 10;
          reasons.push(`File extension (.${ext}) may not match MIME type (${file.mimetype})`);
        }
      }
    }

    return {
      suspicious: score >= 15,
      localScore: Math.min(score, 100),
      reasons
    };
  }

  // ─── VIDEO PRE-CHECK ──────────────────────────────────────────
  preCheckVideo(file) {
    if (!file) return { suspicious: false, localScore: 0, reasons: [] };

    const reasons = [];
    let score = 0;
    const name = (file.originalname || '').toLowerCase();
    const sizeMB = file.size / (1024 * 1024);

    // 1. Suspicious filename
    for (const keyword of this.suspiciousMediaKeywords) {
      if (name.includes(keyword)) {
        score += 30;
        reasons.push(`Filename contains suspicious keyword: "${keyword}"`);
      }
    }

    // 2. Unusually small video (auto-generated clip)
    if (sizeMB < 0.1) {
      score += 20;
      reasons.push('Video file is unusually small (< 100KB)');
    }

    return {
      suspicious: score >= 15,
      localScore: Math.min(score, 100),
      reasons
    };
  }

  // ─── DOCUMENT PRE-CHECK ───────────────────────────────────────
  preCheckDocument(file) {
    if (!file) return { suspicious: false, localScore: 0, reasons: [] };

    const reasons = [];
    let score = 0;
    const name = (file.originalname || '').toLowerCase();

    // 1. Double extension trick
    const parts = name.split('.');
    if (parts.length > 2) {
      const suspiciousExts = ['exe', 'bat', 'cmd', 'scr', 'js', 'vbs', 'ps1'];
      if (suspiciousExts.includes(parts[parts.length - 1])) {
        score += 60;
        reasons.push('File uses double-extension trick (possible malware)');
      }
    }

    // 2. Suspicious filename keywords
    const docSuspiciousKeywords = ['invoice', 'payment', 'verify', 'confirm', 'urgent', 'action required', 'password'];
    for (const kw of docSuspiciousKeywords) {
      if (name.includes(kw)) {
        score += 15;
        reasons.push(`Document filename contains suspicious keyword: "${kw}"`);
      }
    }

    return {
      suspicious: score >= 15,
      localScore: Math.min(score, 100),
      reasons
    };
  }
}

module.exports = new PreCheckFilter();
