import { useState, useRef, useEffect } from 'react';
import { analyzeText, analyzeURL, analyzeAudio, analyzeImage, analyzeDocument, analyzeVideo } from '../utils/api';
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
    { id: 'text', label: 'Message', icon: '💬', placeholder: 'Paste a suspicious message here...\n\nExample: "Congratulations! You won $1,000,000! Click here to claim your prize now!"' },
    { id: 'url', label: 'URL', icon: '🔗', placeholder: 'Enter a suspicious URL...\n\nExample: https://faceb00k-login.com/verify' },
    { id: 'document', label: 'Document', icon: '📄', accept: '.pdf,.doc,.docx,.txt' },
    { id: 'audio', label: 'Audio', icon: '🎙️', accept: 'audio/*' },
    { id: 'image', label: 'Image', icon: '🖼️', accept: 'image/*' },
    { id: 'video', label: 'Video (AI)', icon: '🎞️', accept: 'video/*' }
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
          if (!input.trim()) { setError('Please enter a message to analyze'); setLoading(false); return; }
          res = await analyzeText(input);
          break;
        case 'url':
          if (!input.trim()) { setError('Please enter a URL to analyze'); setLoading(false); return; }
          res = await analyzeURL(input);
          break;
        case 'document':
          if (!file) { setError('Please upload a document file'); setLoading(false); return; }
          res = await analyzeDocument(file);
          break;
        case 'audio':
          if (!file) { setError('Please upload an audio file'); setLoading(false); return; }
          res = await analyzeAudio(file);
          break;
        case 'image':
          if (!file) { setError('Please upload an image file'); setLoading(false); return; }
          res = await analyzeImage(file);
          break;
        case 'video':
          if (!file) { setError('Please upload a video file for Deepfake check'); setLoading(false); return; }
          res = await analyzeVideo(file);
          break;
      }

      // Small delay to let the last phase complete visually
      await new Promise(resolve => setTimeout(resolve, 600));
      setResult(res);
    } catch (e) {
      if (e.message?.includes('429')) {
        setError('Rate limit exceeded. Please wait a moment before scanning again.');
      } else if (e.message?.includes('413')) {
        setError('File too large. Maximum file size is 10MB.');
      } else {
        setError('Analysis failed. Make sure the backend server is running and API keys are valid.');
      }
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

  const isFileTab = ['audio', 'image', 'document', 'video'].includes(activeTab);
  const currentTabData = tabs.find(t => t.id === activeTab);
  const phases = getPhases();

  return (
    <section className="scanner" id="scanner">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">
            <span className="title-icon">🛡️</span>
            Threat <span className="gradient-text">Scanner</span>
          </h2>
          <p className="section-desc">Paste content or upload files to analyze for threats in real-time</p>
        </div>

        <div className="scanner-card glass-card">
          {/* Tabs */}
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

          {/* Input Area */}
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
                    <div className="file-details">
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    {file.size > 10 * 1024 * 1024 && (
                      <div className="file-warning">⚠️ Exceeds 10MB limit</div>
                    )}
                    <button className="file-remove" onClick={(e) => { e.stopPropagation(); setFile(null); }}>✕</button>
                  </div>
                ) : (
                  <div className="drop-content">
                    <div className="drop-icon">{currentTabData.icon}</div>
                    <div className="drop-text">
                      Drag & drop your {currentTabData.label.toLowerCase()} here
                    </div>
                    <div className="drop-subtext">or click to browse (max 10MB)</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && <div className="scanner-error">{error}</div>}

          {/* Scan Button */}
          <button className="scan-button" onClick={handleScan} disabled={loading}>
            {loading ? (
              <>
                <div className="scan-spinner"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>Analyze Content</span>
              </>
            )}
          </button>

          {/* ─── MULTI-PHASE PROGRESS ANIMATION ──────────────── */}
          {loading && (
            <div className="scan-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${phaseProgress}%` }}></div>
              </div>
              <div className="phase-indicators">
                {phases.map((phase, index) => (
                  <div
                    key={phase.id}
                    className={`phase-item ${index < currentPhase ? 'completed' : ''} ${index === currentPhase ? 'active' : ''} ${index > currentPhase ? 'pending' : ''}`}
                  >
                    <div className="phase-dot">
                      {index < currentPhase ? '✓' : index === currentPhase ? phase.icon : ''}
                    </div>
                    <span className="phase-label">{phase.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="scanner-results slide-up">
            <ThreatMeter score={result.riskScore} level={result.riskLevel} />
            <ResultCard result={result} />
          </div>
        )}
      </div>
    </section>
  );
}
