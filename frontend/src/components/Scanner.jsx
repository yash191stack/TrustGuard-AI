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
    { id: 'text', label: 'MESSAGE', icon: '[TXT]', placeholder: 'PASTE SUSPICIOUS TEXT HERE...' },
    { id: 'url', label: 'LINK', icon: '[URL]', placeholder: 'ENTER A SUSPICIOUS URL HERE...' },
    { id: 'document', label: 'DOC', icon: '[DOC]', accept: '.pdf,.doc,.docx,.txt' },
    { id: 'audio', label: 'AUDIO', icon: '[WAV]', accept: 'audio/*' },
    { id: 'image', label: 'IMG', icon: '[JPG]', accept: 'image/*' },
    { id: 'video', label: 'VIDEO', icon: '[MP4]', accept: 'video/*' }
  ];

  const handleScan = async () => {
    setError('');
    setResult(null);
    setLoading(true);
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
        case 'audio':
          if (!file) { setError('FATAL: AUDIO UPLOAD REQUIRED'); setLoading(false); return; }
          res = await analyzeAudio(file);
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

  const isFileTab = ['audio', 'image', 'document', 'video'].includes(activeTab);
  const currentTab = tabs.find(t => t.id === activeTab);

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
                    <button className="file-remove" onClick={(e) => { e.stopPropagation(); setFile(null); }}>[X]</button>
                  </div>
                ) : (
                  <div className="drop-content">
                    <div className="drop-icon">[+]</div>
                    <div className="drop-text">DROP {currentTab.label} HERE</div>
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
                <div className="progress-fill"></div>
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
