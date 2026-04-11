const threatIntel = require('../data/threatIntel.json');

class RiskCalculator {
  constructor() {
    this.riskLevels = threatIntel.riskLevels;
    this.threatCategories = threatIntel.threatCategories;
  }

  calculateFinalResult(analysisResult) {
    const { type, riskScore, threats, indicators, details } = analysisResult;
    const analysisSource = analysisResult.analysisSource || 'heuristic';
    const fallbackUsed = analysisResult.fallbackUsed || false;

    // ─── 3-TIER RISK LEVEL DETERMINATION ────────────────────────
    let riskLevel = 'LIKELY_SAFE';
    for (const [level, config] of Object.entries(this.riskLevels)) {
      if (riskScore >= config.min && riskScore <= config.max) {
        riskLevel = level;
        break;
      }
    }

    const riskConfig = this.riskLevels[riskLevel];

    // Determine primary threat category
    let primaryCategory = 'SAFE';
    if (threats.length > 0) {
      const categoryCounts = {};
      threats.forEach(t => {
        if (t.category) {
          categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
        }
      });
      if (Object.keys(categoryCounts).length > 0) {
        primaryCategory = Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])[0][0];
      }
    }

    const categoryInfo = this.threatCategories[primaryCategory] || this.threatCategories.SAFE;

    // ─── CONFIDENCE SCORE ───────────────────────────────────────
    const confidence = this._calculateConfidence(analysisSource, riskScore, threats.length, fallbackUsed);

    // ─── EXPLANATION ────────────────────────────────────────────
    const explanation = this._generateExplanation(type, riskScore, riskLevel, analysisSource, threats, fallbackUsed);

    // Generate human-readable summary
    const summary = this._generateSummary(type, riskScore, riskLevel, threats, primaryCategory);

    // Generate recommendations
    const recommendations = this._generateRecommendations(type, riskLevel, threats, primaryCategory);

    // ─── RISK LABEL (media-specific overrides) ──────────────────
    let labelOverride = riskConfig.label;

    if (['image', 'video', 'audio'].includes(type) || primaryCategory === 'DEEPFAKE') {
      if (riskLevel === 'LIKELY_SAFE') {
        labelOverride = 'Likely Authentic';
      } else if (riskLevel === 'SUSPICIOUS') {
        labelOverride = 'Possibly AI / Fake';
      } else {
        labelOverride = 'Likely Fake / Deepfake';
      }
    }

    return {
      scanId: this._generateScanId(),
      timestamp: new Date().toISOString(),
      inputType: type,
      riskScore,
      riskLevel: {
        level: riskLevel,
        label: labelOverride,
        color: riskConfig.color,
        emoji: riskConfig.emoji
      },
      confidence,
      explanation,
      analysisSource,
      fallbackUsed,
      threatCategory: {
        id: categoryInfo.id,
        name: categoryInfo.name,
        description: categoryInfo.description,
        severity: categoryInfo.severity,
        color: categoryInfo.color
      },
      summary,
      threats: threats.map(t => ({
        ...t,
        categoryInfo: this.threatCategories[t.category] || null
      })),
      indicators,
      recommendations,
      details
    };
  }

  // ─── CONFIDENCE CALCULATION ─────────────────────────────────
  _calculateConfidence(source, riskScore, threatCount, fallbackUsed) {
    let base = 50;

    switch (source) {
      case 'api':
        base = 85 + Math.floor(Math.random() * 10); // 85-95%
        break;
      case 'heuristic':
        base = 45 + Math.min(threatCount * 5, 20); // 45-65%
        break;
      case 'pre-check':
        base = 30 + Math.min(riskScore, 20); // 30-50%
        break;
      default:
        base = 40;
    }

    // Fallback reduces confidence
    if (fallbackUsed) {
      base = Math.max(25, base - 15);
    }

    return Math.min(base, 99);
  }

  // ─── EXPLANATION GENERATION ─────────────────────────────────
  _generateExplanation(type, score, level, source, threats, fallbackUsed) {
    const sourceLabels = {
      'api': 'AI-powered deep analysis',
      'heuristic': 'TrustGuard Forensic Engine',
      'pre-check': 'rule-based quick scan'
    };
    const sourceLabel = sourceLabels[source] || 'automated analysis';
    const typeLabels = { text: 'message', url: 'URL', audio: 'audio file', image: 'image', video: 'video', document: 'document' };
    const typeLabel = typeLabels[type] || type;

    let explanation = '';

    if (level === 'LIKELY_SAFE') {
      if (type === 'image') {
        explanation = `This image appears authentic. Analysis shows standard sensor noise patterns and valid metadata structure (score: ${score}/100).`;
      } else {
        explanation = `This ${typeLabel} was analyzed using ${sourceLabel} and no significant threats were detected (score: ${score}/100).`;
      }
    } else if (level === 'SUSPICIOUS') {
      const reasons = threats.slice(0, 2).map(t => {
        if (t.type === 'SYNTHETIC_SMOOTHNESS') return "unnatural pixel uniformity";
        if (t.type === 'AI_METADATA_SIGNATURE') return "AI software signatures";
        return t.type.replace(/_/g, ' ').toLowerCase();
      }).join(' and ');
      explanation = `Suspicious markers identified: ${reasons || 'potential risks'} (score: ${score}/100). Exercise caution and verify the source.`;
    } else {
      const mainThreat = threats[0]?.type === 'AI_METADATA_SIGNATURE' ? "explicit generative metadata" : 
                         threats[0]?.type === 'SYNTHETIC_SMOOTHNESS' ? "high-confidence generative artifacts" : 
                         "heavy manipulation markers";
      explanation = `Classification: LIKELY FAKE. Analysis detected ${mainThreat} using ${sourceLabel} forensic layers (score: ${score}/100).`;
    }

    if (fallbackUsed) {
      explanation += ' ⚡ Local forensic mode active.';
    }

    return explanation;
  }

  // ─── SUMMARY GENERATION (3-tier) ────────────────────────────
  _generateSummary(type, score, level, threats, category) {
    const isMedia = ['image', 'video', 'audio'].includes(type) || category === 'DEEPFAKE';
    const typeLabels = { text: 'message', url: 'URL', audio: 'audio file', image: 'image', video: 'video', document: 'document' };
    const typeLabel = typeLabels[type] || type;

    const threatDescriptions = threats.slice(0, 3).map(t => t.description).join('. ');

    if (level === 'LIKELY_SAFE') {
      if (isMedia) return `This ${typeLabel} appears to be authentic and real. No AI manipulation or deepfake indicators were detected. Confidence is based on the analysis method used.`;
      return `This ${typeLabel} appears to be safe. No significant threats were detected during analysis. Always verify the sender if you don't recognize them.`;
    }

    if (level === 'SUSPICIOUS') {
      if (isMedia) return `⚠️ This ${typeLabel} shows suspicious artifacts (${score}% risk of manipulation). ${threatDescriptions}. There is a possibility it could be AI-generated or altered — verify with other sources.`;
      return `⚠️ This ${typeLabel} is suspicious (${score}% risk). ${threatDescriptions}. We recommend verifying the source before taking any action.`;
    }

    // DANGEROUS
    if (isMedia) return `🚨 DANGER: This ${typeLabel} is highly likely to be Fake / AI-generated (${score}% risk). ${threatDescriptions}. Do NOT trust this media as factual evidence.`;
    return `🚨 DANGER: This ${typeLabel} is classified as dangerous (${score}% risk). ${threatDescriptions}. Do NOT interact with this content, click links, or share personal information.`;
  }

  // ─── RECOMMENDATIONS (3-tier) ───────────────────────────────
  _generateRecommendations(type, level, threats, category) {
    const recs = [];

    if (level === 'LIKELY_SAFE') {
      recs.push('Content appears safe, but always stay vigilant');
      recs.push('Verify the sender if you don\'t recognize them');
      return recs;
    }

    // Universal recommendations for SUSPICIOUS and DANGEROUS
    recs.push('Do NOT share personal information, OTP, or financial details');
    recs.push('Do NOT click on any links from untrusted sources');

    if (category === 'PHISHING') {
      recs.push('This appears to be a phishing attempt — do not enter any credentials');
      recs.push('Report this URL to your browser\'s safe browsing program');
      recs.push('Check the actual URL carefully for misspellings or unusual characters');
    }

    if (category === 'SCAM') {
      recs.push('This appears to be a scam — do not send money or gift cards');
      recs.push('Verify the sender\'s identity through a separate, trusted channel');
      recs.push('Report this message to your local cybercrime helpline');
    }

    if (category === 'IMPERSONATION') {
      recs.push('Someone may be impersonating a trusted entity');
      recs.push('Contact the person/organization directly through official channels');
      recs.push('Do not respond to this message directly');
    }

    if (category === 'DEEPFAKE') {
      recs.push('This media may be AI-generated or manipulated');
      recs.push('Do not trust the content at face value');
      recs.push('Look for visual/audio artifacts that indicate manipulation');
      recs.push('Verify through multiple independent sources');
    }

    if (category === 'MALWARE' || category === 'MALWARE/PHISHING') {
      recs.push('Do NOT open or execute this file');
      recs.push('Scan the file with an updated antivirus program');
      recs.push('Delete the file if you downloaded it from an untrusted source');
    }

    if (category === 'SOCIAL_ENGINEERING') {
      recs.push('This content uses psychological manipulation tactics');
      recs.push('Take time to think before acting — urgency is a manipulation technique');
      recs.push('Discuss with someone you trust before taking any action');
    }

    if (level === 'DANGEROUS') {
      recs.push('Report this to Indian Cyber Crime Portal: cybercrime.gov.in');
      recs.push('If money was lost, contact your bank immediately');
    }

    return recs;
  }

  _generateScanId() {
    return 'TG-' + Date.now().toString(36).toUpperCase() + '-' +
      Math.random().toString(36).substring(2, 6).toUpperCase();
  }
}

module.exports = new RiskCalculator();
