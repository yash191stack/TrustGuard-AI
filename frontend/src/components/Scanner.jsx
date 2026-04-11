import { useState, useRef, useEffect } from 'react';
import { analyzeText, analyzeURL, analyzeImage, analyzeDocument, analyzeVideo } from '../utils/api';
import ThreatMeter from './ThreatMeter';
import ResultCard from './ResultCard';
import './Scanner.css';

const ANALYSIS_PHASES = [
  { id: 'receiving', label: 'Receiving input', icon: '📥' },
  { id: 'precheck', label: 'Running pre-check filters', icon: '🔍' },
  { id: 'analyzing', label: 'Deep analysis in progress', icon: '🧠' },
  { id: 'frames', label: 'Analyzing sampled frames', icon: '🎞️' },
  { id: 'calculating', label: 'Calculating risk score', icon: '📊' },
  { id: 'report', label: 'Generating report', icon: '📋' }
];

export default function Scanner() {
  const [activeTab, setActiveTab] = useState('text');
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const fileRef = useRef(null);
  const phaseTimerRef = useRef(null);

  const tabs = [
    { id: 'text', label: 'MESSAGE', icon: '[TXT]', placeholder: 'PASTE SUSPICIOUS TEXT HERE...' },
    { id: 'url', label: 'LINK', icon: '[URL]', placeholder: 'ENTER A SUSPICIOUS URL HERE...' },
    { id: 'document', label: 'DOC', icon: '[DOC]', accept: '.pdf,.doc,.docx,.txt' },
    { id: 'image', label: 'IMG', icon: '[JPG]', accept: 'image/*' },
    { id: 'video', label: 'VIDEO', icon: '[MP4]', accept: 'video/*' }
  ];

  // Get relevant phases for current tab
  const getPhases = () => {
    if (activeTab === 'video') return ANALYSIS_PHASES;
    return ANALYSIS_PHASES.filter(p => p.id !== 'frames');
  };

  // Animate through phases while loading
  useEffect(() => {
    if (!loading) {
      setCurrentPhase(0);
      setPhaseProgress(0);
      return;
    }

    const phases = getPhases();
    let phase = 0;
    setCurrentPhase(0);
    setPhaseProgress(0);

    const advancePhase = () => {
      phase++;
      if (phase < phases.length) {
        setCurrentPhase(phase);
        setPhaseProgress(Math.round((phase / phases.length) * 100));
      }
    };

    // Advance phases every 1.5-2.5 seconds
    const intervals = [];
    let delay = 800;
    for (let i = 1; i < phases.length; i++) {
      delay += 1200 + Math.random() * 1000;
      const timeout = setTimeout(advancePhase, delay);
      intervals.push(timeout);
    }

    phaseTimerRef.current = intervals;

    return () => {
      intervals.forEach(clearTimeout);
    };
  }, [loading, activeTab]);

  const handleScan = async () => {
    setError('');
    setResult(null);
    setLoading(true);

    // Client-side file size check (10MB)
    if (file && file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      setLoading(false);
      return;
    }

    try {
      let res;
      switch (activeTab) {
        case 'text':
          if (!input.trim()) { setError('FATAL: INPUT REQUIRED'); setLoading(false); return; }
          res = await analyzeText(input);
          break;
        case 'url':
          if (!input.trim()) { setError('FATAL: URL REQUIRED'); setLoading(false); return; }
          res = await analyzeURL(input);
          break;
        case 'document':
          if (!file) { setError('FATAL: DOC UPLOAD REQUIRED'); setLoading(false); return; }
          res = await analyzeDocument(file);
          break;
        case 'image':
          if (!file) { setError('FATAL: IMAGE UPLOAD REQUIRED'); setLoading(false); return; }
          res = await analyzeImage(file);
          break;
        case 'video':
          if (!file) { setError('FATAL: VIDEO UPLOAD REQUIRED'); setLoading(false); return; }
          res = await analyzeVideo(file);
          break;
      }

      // Small delay to let the last phase complete visually
      await new Promise(resolve => setTimeout(resolve, 600));
      setResult(res);
    } catch (e) {
      setError('SYSTEM ERROR: BACKEND UNAVAILABLE OR API KEY INVALID.');
    }
    setLoading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleTabChange = (id) => {
    setActiveTab(id);
    setInput('');
    setFile(null);
    setResult(null);
    setError('');
  };

  const isFileTab = ['image', 'document', 'video'].includes(activeTab);
  const currentTabData = tabs.find(t => t.id === activeTab);
  const phases = getPhases();

  return (
    <section className="scanner" id="scanner">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">
            <span className="title-icon">⚠</span>
            THREAT <span className="brutal-highlight-green">SCANNER</span>
          </h2>
          <p className="section-desc">PASTE OR UPLOAD TO ANALYZE IN REAL-TIME</p>
        </div>

        <div className="scanner-card">
          <div className="scanner-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`scanner-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="scanner-input-area">
            {!isFileTab ? (
              <textarea
                className="scanner-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={currentTabData.placeholder}
                rows={6}
              />
            ) : (
              <div
                className={`file-drop-zone ${file ? 'has-file' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={currentTabData.accept}
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                {file ? (
                  <div className="file-info">
                    <div className="file-icon">{currentTabData.icon}</div>
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
                    <button className="file-remove" onClick={(e) => { e.stopPropagation(); setFile(null); }}>[X]</button>
                  </div>
                ) : (
                  <div className="drop-content">
                    <div className="drop-icon">[+]</div>
                    <div className="drop-text">DROP {currentTabData.label} HERE</div>
                    <div className="drop-subtext">OR CLICK TO BROWSE</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <div className="scanner-error">{error}</div>}

          <button className="scan-button" onClick={handleScan} disabled={loading}>
            {loading ? (
              <span>[ EXEC... ]</span>
            ) : (
              <span>INITIATE ANALYSIS //_</span>
            )}
          </button>

          {loading && (
            <div className="scan-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${phaseProgress}%` }}></div>
              </div>
              <div className="progress-steps hidden-mobile">
                <span className="step active">RCV INPUT</span>
                <span className="step">PATTERN MATCH</span>
                <span className="step">API VALIDATE</span>
                <span className="step">REPORT GEN</span>
              </div>
            </div>
          )}
        </div>

        {result && (
          <div className="scanner-results">
            <ThreatMeter score={result.riskScore} level={result.riskLevel} />
            <ResultCard result={result} />
          </div>
        )}
      </div>
    </section>
  );
}
