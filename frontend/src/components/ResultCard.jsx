import { useState } from 'react';
import './ResultCard.css';

export default function ResultCard({ result }) {
  const [expanded, setExpanded] = useState(false);

  if (!result) return null;

  const { summary, threats, indicators, recommendations, threatCategory, details, scanId } = result;

  return (
    <div className="result-card glass-card">
      {/* Header */}
      <div className="result-header">
        <div className="result-category" style={{ borderColor: threatCategory?.color }}>
          <div className="category-dot" style={{ background: threatCategory?.color }}></div>
          <span style={{ color: threatCategory?.color }}>{threatCategory?.name}</span>
        </div>
        <div className="result-scan-id">{scanId}</div>
      </div>

      {/* Summary */}
      <div className="result-summary">{summary}</div>

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
