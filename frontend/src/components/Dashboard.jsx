import { useState, useEffect } from 'react';
import { getStats } from '../utils/api';
import './Dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getStats().then(setStats).catch(() => setError(true));
  }, []);

  if (error) return (
    <section className="dashboard" id="dashboard">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title"><span className="title-icon">📊</span> Threat <span className="gradient-text">Dashboard</span></h2>
        </div>
        <div className="dash-error glass-card">⚠️ Could not load dashboard. Ensure backend is running.</div>
      </div>
    </section>
  );

  if (!stats) return (
    <section className="dashboard" id="dashboard">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title"><span className="title-icon">📊</span> Threat <span className="gradient-text">Dashboard</span></h2>
        </div>
        <div className="dash-loading">Loading threat intelligence...</div>
      </div>
    </section>
  );

  const cards = [
    { label: 'Total Scans', value: stats.platformStats.totalScans.toLocaleString(), icon: '🔍', color: '#00ff88' },
    { label: 'Threats Detected', value: stats.platformStats.threatsDetected.toLocaleString(), icon: '🚨', color: '#ff4444' },
    { label: 'Phishing Blocked', value: stats.platformStats.phishingBlocked.toLocaleString(), icon: '🔗', color: '#ff8800' },
    { label: 'Deepfakes Found', value: stats.platformStats.deepfakesDetected.toLocaleString(), icon: '🎭', color: '#a855f7' },
    { label: 'Users Protected', value: stats.platformStats.usersProtected.toLocaleString(), icon: '👥', color: '#00d4ff' },
    { label: 'Accuracy', value: stats.platformStats.accuracyRate, icon: '🎯', color: '#00ff88' },
  ];

  return (
    <section className="dashboard" id="dashboard">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title"><span className="title-icon">📊</span> Threat <span className="gradient-text">Dashboard</span></h2>
          <p className="section-desc">Real-time cybersecurity threat intelligence</p>
        </div>

        <div className="stats-grid">
          {cards.map((card, i) => (
            <div key={i} className="stat-card glass-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="stat-card-icon">{card.icon}</div>
              <div className="stat-card-value" style={{ color: card.color }}>{card.value}</div>
              <div className="stat-card-label">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="dash-sections">
          <div className="global-stats glass-card">
            <h3 className="dash-subtitle">🌍 Global Threat Landscape</h3>
            <div className="global-grid">
              {Object.entries(stats.globalStats).map(([key, val], i) => (
                <div key={i} className="global-item">
                  <div className="global-value">{val}</div>
                  <div className="global-label">{key.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase())}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="recent-threats glass-card">
            <h3 className="dash-subtitle">⚡ Recent Threat Alerts</h3>
            <div className="threats-table">
              {stats.recentThreats.map((t, i) => (
                <div key={i} className="threat-row">
                  <span className={`threat-severity-dot ${t.severity.toLowerCase()}`}></span>
                  <span className="threat-row-type">{t.type}</span>
                  <span className="threat-row-target">{t.target}</span>
                  <span className="threat-row-region">{t.region}</span>
                  <span className={`threat-row-sev ${t.severity.toLowerCase()}`}>{t.severity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
