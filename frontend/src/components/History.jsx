import { useState, useEffect } from 'react';
import { getHistory } from '../utils/api';
import './History.css';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory()
      .then(data => { setHistory(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const getRiskColor = (score) => {
    if (score <= 20) return '#00ff88';
    if (score <= 40) return '#88ff00';
    if (score <= 60) return '#ffaa00';
    if (score <= 80) return '#ff4400';
    return '#ff0044';
  };

  return (
    <section className="history" id="history">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title"><span className="title-icon">📋</span> Scan <span className="gradient-text">History</span></h2>
          <p className="section-desc">View your recent content analysis results</p>
        </div>

        {loading ? (
          <div className="history-loading">Loading scan history...</div>
        ) : history.length === 0 ? (
          <div className="history-empty glass-card">
            <div className="empty-icon">🔍</div>
            <h3>No Scans Yet</h3>
            <p>Your scan history will appear here after you analyze content using the scanner above.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.map((item, i) => (
              <div key={i} className="history-item glass-card" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="history-risk" style={{ background: getRiskColor(item.riskScore), boxShadow: `0 0 12px ${getRiskColor(item.riskScore)}40` }}>
                  {item.riskScore}%
                </div>
                <div className="history-content">
                  <div className="history-top">
                    <span className="history-type">{item.inputType?.toUpperCase()}</span>
                    <span className="history-level" style={{ color: item.riskLevel?.color }}>
                      {item.riskLevel?.emoji} {item.riskLevel?.label}
                    </span>
                  </div>
                  <div className="history-preview">{item.inputPreview || 'N/A'}</div>
                  <div className="history-meta">
                    <span>{item.threatCategory?.name}</span>
                    <span>•</span>
                    <span>{item.threats?.length || 0} threats</span>
                    <span>•</span>
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
