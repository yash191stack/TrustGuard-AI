import { useState } from 'react';
import './ResultCard.css';

export default function ResultCard({ result }) {
  const [expanded, setExpanded] = useState(false);

  if (!result) return null;

  const { summary, explanation, confidence, analysisSource, fallbackUsed, threats, indicators, recommendations, threatCategory, details, scanId } = result;

  const sourceLabels = {
    'api': { label: '🔬 AI Deep Analysis', className: 'source-api' },
    'heuristic': { label: '🔧 Heuristic Analysis', className: 'source-heuristic' },
    'pre-check': { label: '⚡ Quick Pre-check', className: 'source-precheck' },
    'none': { label: '—', className: '' }
  };

  const sourceInfo = sourceLabels[analysisSource] || sourceLabels['none'];

  const riskClass = result.riskLevel?.level?.toLowerCase().replace('_', '-') || 'safe';

  return (
    <div className={`result-card glass-card risk-${riskClass}`}>
      {/* Header */}
      <div className="result-header">
        <div className="result-category" style={{ borderColor: threatCategory?.color }}>
          <div className="category-dot" style={{ background: threatCategory?.color }}></div>
          <span style={{ color: threatCategory?.color }}>{threatCategory?.name}</span>
        </div>
        <div className="result-header-right">
          <div className={`analysis-source ${sourceInfo.className}`}>
            {sourceInfo.label}
          </div>
          <div className="result-scan-id">{scanId}</div>
        </div>
      </div>

      {/* Fallback Badge */}
      {fallbackUsed && (
        <div className="fallback-badge">
          <span className="fallback-icon">⚡</span>
          <span>Local analysis only — External API was unavailable</span>
        </div>
      )}

      {/* Summary */}
      <div className="result-summary">{summary}</div>

      {/* Explanation + Confidence */}
      {(explanation || confidence) && (
        <div className="explanation-section">
          {explanation && (
            <div className="explanation-box">
              <div className="explanation-label">📝 Analysis Explanation</div>
              <p className="explanation-text">{explanation}</p>
            </div>
          )}
          {confidence > 0 && (
            <div className="confidence-section">
              <div className="confidence-header">
                <span className="confidence-label">Confidence Score</span>
                <span className="confidence-value">{confidence}%</span>
              </div>
              <div className="confidence-bar-bg">
                <div
                  className="confidence-bar-fill"
                  style={{
                    width: `${confidence}%`,
                    background: confidence >= 80 ? 'var(--accent-green)' : confidence >= 50 ? 'var(--warning-amber)' : 'var(--danger-red)',
                    boxShadow: `0 0 8px ${confidence >= 80 ? 'rgba(0,255,136,0.4)' : confidence >= 50 ? 'rgba(255,170,0,0.4)' : 'rgba(255,68,68,0.4)'}`
                  }}
                ></div>
              </div>
              <div className="confidence-hint">
                {confidence >= 80 ? 'High confidence — powered by AI deep analysis' :
                 confidence >= 50 ? 'Moderate confidence — based on pattern matching' :
                 'Low confidence — basic pre-check only'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Threats */}
      {threats.length > 0 && (
        <div className="result-section">
          <h4 className="section-label">⚠️ Threats Detected ({threats.length})</h4>
          <div className="threats-list">
            {threats.map((t, i) => (
              <div key={i} className={`threat-item severity-${t.severity}`}>
                <div className="threat-header">
                  <span className="threat-type">{t.type.replace(/_/g, ' ')}</span>
                  <span className={`severity-badge ${t.severity}`}>{t.severity}</span>
                </div>
                <p className="threat-desc">{t.description}</p>
                {t.matches && t.matches.length > 0 && (
                  <div className="threat-matches">
                    {t.matches.map((m, j) => (
                      <span key={j} className="match-tag">{m}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Indicators */}
      {indicators.length > 0 && (
        <div className="result-section">
          <h4 className="section-label">🔍 Key Indicators</h4>
          <div className="indicators-grid">
            {indicators.map((ind, i) => (
              <div key={i} className={`indicator-chip ${ind.highlight ? 'highlight' : ''}`}>
                <span className="indicator-keyword">{ind.keyword}</span>
                <span className="indicator-type">{ind.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="result-section">
          <h4 className="section-label">✅ Recommendations</h4>
          <ul className="recommendations-list">
            {recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cost Optimization Badge */}
      {details?.costSaved && (
        <div className="cost-saved-badge">
          <span>💰</span>
          <span>API call saved — content analyzed using local pre-check rules</span>
        </div>
      )}

      {/* Details Toggle */}
      <button className="details-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? '▲ Hide Details' : '▼ Show Technical Details'}
      </button>

      {expanded && (
        <div className="result-details fade-in">
          <pre>{JSON.stringify(details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
