import { useEffect, useState } from 'react';
import CyberShield from './CyberShield';
import './Hero.css';

export default function Hero({ onNavigate }) {
  const [count1, setCount1] = useState(0);
  const [count2, setCount2] = useState(0);
  const [count3, setCount3] = useState(0);

  useEffect(() => {
    // simplified or skipped animation due to Brutalism, but keeping counts for display
    setCount1(175000);
    setCount2(97);
    setCount3(45000);
  }, []);

  return (
    <section className="hero offset-left-1" id="home">
      <div className="brutal-bg-pattern"></div>
      <div className="hero-content container">
        
        <div className="brutal-sticker offset-right-2" style={{ marginBottom: '20px' }}>
          <span className="badge-dot"></span>
          AI-POWERED SHIELD v2.0
        </div>

        <CyberShield />

        <h1 className="hero-title">
          DETECT <br/>
          <span className="brutal-highlight-yellow">SCAMS</span>, 
          <span className="brutal-highlight-green">PHISHING</span> 
          <br/>& <span className="brutal-highlight-blue">DEEPFAKES</span>
        </h1>

        <div className="brutal-divider"></div>

        <p className="hero-subtitle">
          PASTE A MESSAGE, ENTER A URL, OR UPLOAD MEDIA.<br/>
          OUR ENGINE TELLS YOU IF IT'S <strong>SAFE</strong> OR <strong>DANGEROUS</strong>. INSTANTLY. NO BS.
        </p>

        <div className="hero-actions">
          <button className="btn-primary" onClick={() => onNavigate('scanner')}>
            START SCANNING [➔]
          </button>
          <button className="btn-secondary offset-left-1" onClick={() => onNavigate('education')}>
            LEARN THREATS [?]
          </button>
        </div>

        <div className="hero-stats brutal-box-container offset-right-2">
          <div className="stat-card offset-left-3">
            <div className="stat-value">{count1.toLocaleString()}+</div>
            <div className="stat-label">THREATS DETECTED</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{count2}%</div>
            <div className="stat-label">ACCURACY RATE</div>
          </div>
          <div className="stat-card offset-right-2">
            <div className="stat-value">{count3.toLocaleString()}+</div>
            <div className="stat-label">USERS PROTECTED</div>
          </div>
        </div>

        <div className="brutal-divider"></div>

        <div className="hero-features offset-left-1">
          {[
            { icon: '💬', title: 'TEXT', desc: 'SCAMS & SPAM' },
            { icon: '🔗', title: 'URL', desc: 'PHISHING DB' },
            { icon: '🎙️', title: 'AUDIO', desc: 'DEEPFAKE DETECT' },
            { icon: '🖼️', title: 'MEDIA', desc: 'FORGERY CHECK' }
          ].map((f, i) => (
            <div key={i} className="feature-card offset-left-1">
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
