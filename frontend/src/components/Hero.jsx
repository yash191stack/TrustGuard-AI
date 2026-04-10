import { useEffect, useState } from 'react';
import './Hero.css';

export default function Hero({ onNavigate }) {
  const [count1, setCount1] = useState(0);
  const [count2, setCount2] = useState(0);
  const [count3, setCount3] = useState(0);

  useEffect(() => {
    const animate = (setter, target, duration) => {
      let start = 0;
      const step = target / (duration / 16);
      const interval = setInterval(() => {
        start += step;
        if (start >= target) { setter(target); clearInterval(interval); }
        else setter(Math.floor(start));
      }, 16);
    };
    const t = setTimeout(() => {
      animate(setCount1, 175000, 2000);
      animate(setCount2, 97, 1800);
      animate(setCount3, 45000, 2000);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="hero" id="home">
      <div className="hero-bg-grid"></div>
      <div className="hero-content container">
        <div className="hero-badge">
          <span className="badge-dot"></span>
          <span>AI-Powered Cybersecurity Shield</span>
        </div>

        <h1 className="hero-title">
          Detect <span className="gradient-text">Scams</span>,{' '}
          <span className="gradient-text-cyan">Phishing</span> &{' '}
          <span className="gradient-text-purple">Deepfakes</span>
          <br />in Real-Time
        </h1>

        <p className="hero-subtitle">
          Paste a message, enter a URL, or upload media — our AI engine analyzes it
          instantly and tells you if it's <strong>safe</strong> or <strong>dangerous</strong>.
        </p>

        <div className="hero-actions">
          <button className="btn-primary" onClick={() => onNavigate('scanner')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Start Scanning
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('education')}>
            Learn About Threats
          </button>
        </div>

        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-value">{count1.toLocaleString()}+</div>
            <div className="stat-label">Threats Detected</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-value">{count2}%</div>
            <div className="stat-label">Accuracy Rate</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-value">{count3.toLocaleString()}+</div>
            <div className="stat-label">Users Protected</div>
          </div>
        </div>

        <div className="hero-features">
          {[
            { icon: '💬', title: 'Text Analysis', desc: 'Scan messages for scam patterns' },
            { icon: '🔗', title: 'URL Scanner', desc: 'Detect phishing websites' },
            { icon: '🎙️', title: 'Audio Check', desc: 'Identify deepfake voices' },
            { icon: '🖼️', title: 'Media Analysis', desc: 'Detect fake images & videos' }
          ].map((f, i) => (
            <div key={i} className="feature-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
