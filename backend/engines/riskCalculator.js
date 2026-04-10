const threatIntel = require('../data/threatIntel.json');

class RiskCalculator {
  constructor() {
    this.riskLevels = threatIntel.riskLevels;
    this.threatCategories = threatIntel.threatCategories;
  }

  calculateFinalResult(analysisResult) {
    const { type, riskScore, threats, indicators, details } = analysisResult;

    // Determine risk level
    let riskLevel = 'SAFE';
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
        categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
      });
      primaryCategory = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
    }

    const categoryInfo = this.threatCategories[primaryCategory] || this.threatCategories.SAFE;

    // Generate human-readable summary
    const summary = this._generateSummary(type, riskScore, riskLevel, threats, primaryCategory);

    // Generate recommendations
    const recommendations = this._generateRecommendations(type, riskLevel, threats, primaryCategory);

    return {
      scanId: this._generateScanId(),
      timestamp: new Date().toISOString(),
      inputType: type,
      riskScore,
      riskLevel: {
        level: riskLevel,
        label: riskConfig.label,
        color: riskConfig.color,
        emoji: riskConfig.emoji
      },
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

  _generateSummary(type, score, level, threats, category) {
    if (score <= 20) {
      return `This ${type} content appears to be safe. No significant threats were detected during analysis.`;
    }

    const threatDescriptions = threats.slice(0, 3).map(t => t.description).join('. ');
    const typeLabels = { text: 'message', url: 'URL', audio: 'audio file', image: 'image', video: 'video' };
    const typeLabel = typeLabels[type] || type;

    if (score <= 40) {
      return `This ${typeLabel} has some minor suspicious characteristics (${score}% risk). ${threatDescriptions}. Exercise caution but it may be safe.`;
    }
    if (score <= 60) {
      return `⚠️ This ${typeLabel} is suspicious (${score}% risk). ${threatDescriptions}. We recommend verifying the source before taking any action.`;
    }
    if (score <= 80) {
      return `🚨 This ${typeLabel} is likely dangerous (${score}% risk). ${threatDescriptions}. Do NOT interact with this content.`;
    }
    return `🚨 CRITICAL THREAT DETECTED! This ${typeLabel} is extremely dangerous (${score}% risk). ${threatDescriptions}. Do NOT interact, click links, or share personal information.`;
  }

  _generateRecommendations(type, level, threats, category) {
    const recs = [];

    if (level === 'SAFE') {
      recs.push('Content appears safe, but always stay vigilant');
      recs.push('Verify the sender if you don\'t recognize them');
      return recs;
    }

    // Universal recommendations
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

    if (category === 'MALWARE') {
      recs.push('Do NOT open or execute this file');
      recs.push('Scan the file with an updated antivirus program');
      recs.push('Delete the file if you downloaded it from an untrusted source');
    }

    if (category === 'SOCIAL_ENGINEERING') {
      recs.push('This content uses psychological manipulation tactics');
      recs.push('Take time to think before acting — urgency is a manipulation technique');
      recs.push('Discuss with someone you trust before taking any action');
    }

    if (level === 'CRITICAL' || level === 'HIGH') {
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
