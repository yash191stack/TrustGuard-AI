import { useState, useRef } from 'react';
import { analyzeText, analyzeURL, analyzeAudio, analyzeImage, analyzeDocument, analyzeVideo } from '../utils/api';
import ThreatMeter from './ThreatMeter';
import ResultCard from './ResultCard';
import './Scanner.css';

export default function Scanner() {
  const [activeTab, setActiveTab] = useState('text');
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const tabs = [
    { id: 'text', label: 'Message', icon: '💬', placeholder: 'Paste a suspicious message here...\n\nExample: "Congratulations! You won $1,000,000! Click here to claim your prize now!"' },
    { id: 'url', label: 'URL', icon: '🔗', placeholder: 'Enter a suspicious URL...\n\nExample: https://faceb00k-login.com/verify' },
    { id: 'document', label: 'Document', icon: '📄', accept: '.pdf,.doc,.docx,.txt' },
    { id: 'audio', label: 'Audio', icon: '🎙️', accept: 'audio/*' },
    { id: 'image', label: 'Image', icon: '🖼️', accept: 'image/*' },
    { id: 'video', label: 'Video (AI)', icon: '🎞️', accept: 'video/*' }
  ];

  const handleScan = async () => {
    setError('');
    setResult(null);
    setLoading(true);
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
      setResult(res);
    } catch (e) {
      setError('Analysis failed. Make sure the backend server is running and API keys are valid.');
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
  const currentTab = tabs.find(t => t.id === activeTab);

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
                placeholder={currentTab.placeholder}
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
                  accept={currentTab.accept}
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                {file ? (
                  <div className="file-info">
                    <div className="file-icon">{currentTab.icon}</div>
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
                    <button className="file-remove" onClick={(e) => { e.stopPropagation(); setFile(null); }}>✕</button>
                  </div>
                ) : (
                  <div className="drop-content">
                    <div className="drop-icon">{currentTab.icon}</div>
                    <div className="drop-text">
                      Drag & drop your {currentTab.label.toLowerCase()} here
                    </div>
                    <div className="drop-subtext">or click to browse</div>
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
                <span>Analyzing...</span>
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

          {/* Loading Animation */}
          {loading && (
            <div className="scan-progress">
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
              <div className="progress-steps">
                <span className="step active">Receiving input</span>
                <span className="step">Analyzing patterns</span>
                <span className="step">Validating against Live API</span>
                <span className="step">Generating report</span>
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
