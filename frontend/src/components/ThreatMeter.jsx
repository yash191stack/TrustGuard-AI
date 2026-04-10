import { useEffect, useState } from 'react';
import './ThreatMeter.css';

export default function ThreatMeter({ score, level }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let start = 0;
    const step = score / 60;
    const interval = setInterval(() => {
      start += step;
      if (start >= score) { setAnimatedScore(score); clearInterval(interval); }
      else setAnimatedScore(Math.floor(start));
    }, 16);
    return () => clearInterval(interval);
  }, [score]);

  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (animatedScore / 100) * circumference;
  const color = level?.color || '#00ff88';

  return (
    <div className="threat-meter glass-card">
      <div className="meter-visual">
        <svg viewBox="0 0 160 160" className="meter-svg">
          <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="80" cy="80" r="70" fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 80 80)"
            style={{ transition: 'stroke-dashoffset 1.5s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        <div className="meter-center">
          <div className="meter-score" style={{ color }}>{animatedScore}%</div>
          <div className="meter-label">Risk Score</div>
        </div>
      </div>
      <div className="meter-info">
        <div className="meter-level" style={{ color }}>
          <span className="level-emoji">{level?.emoji || '🟢'}</span>
          <span className="level-text">{level?.label || 'Safe'}</span>
        </div>
        <div className="meter-bar-bg">
          <div className="meter-bar-fill" style={{ width: `${animatedScore}%`, background: color, boxShadow: `0 0 12px ${color}` }}></div>
        </div>
      </div>
    </div>
  );
}
