import { useState, useEffect } from 'react';
import './Navbar.css';

export default function Navbar({ activeSection, onNavigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'scanner', label: 'Scanner', icon: '🔍' },
    { id: 'livedeepfake', label: 'Live Cam', icon: '📹' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'history', label: 'History', icon: '📋' },
    { id: 'education', label: 'Learn', icon: '🎓' }
  ];

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-brand" onClick={() => onNavigate('home')}>
          <div className="brand-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="brand-text">TrustGuard<span className="brand-ai">AI</span></span>
        </div>

        <div className={`navbar-links ${mobileOpen ? 'mobile-open' : ''}`}>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-link ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="navbar-status">
          <div className="status-dot"></div>
          <span className="status-text">Engine Active</span>
        </div>

        <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  );
}
