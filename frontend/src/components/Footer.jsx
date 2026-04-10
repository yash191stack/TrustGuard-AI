import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>TrustGuard<span className="brand-ai">AI</span></span>
            </div>
            <p className="footer-tagline">AI-powered cybersecurity shield protecting users from scams, phishing, deepfakes, and online threats in real-time.</p>
          </div>

          <div className="footer-links-group">
            <h4>Features</h4>
            <ul>
              <li>Text Analysis</li>
              <li>URL Scanner</li>
              <li>Audio Deepfake Detection</li>
              <li>Image/Video Analysis</li>
            </ul>
          </div>

          <div className="footer-links-group">
            <h4>Resources</h4>
            <ul>
              <li>Threat Education</li>
              <li>Cybercrime Portal</li>
              <li>Report Scam</li>
              <li>Safety Guidelines</li>
            </ul>
          </div>

          <div className="footer-links-group">
            <h4>Threat Coverage</h4>
            <ul>
              <li>🎣 Phishing Detection</li>
              <li>💰 Financial Scams</li>
              <li>🎭 Deepfake Analysis</li>
              <li>🦠 Malware Scanning</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} TrustGuard AI. Built for Cybersecurity Hackathon.</p>
          <p className="footer-tech">Powered by AI-driven threat intelligence engine</p>
        </div>
      </div>
    </footer>
  );
}
