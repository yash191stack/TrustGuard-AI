import { useState, useEffect } from 'react';
import BrutalDecorations from './components/BrutalDecorations';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Scanner from './components/Scanner';
import LiveDeepfake from './components/LiveDeepfake';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Education from './components/Education';
import Footer from './components/Footer';
import './index.css';

export default function App() {
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Brutalist reveal is faster
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    );

    setTimeout(() => {
      const targets = document.querySelectorAll(
        '.glass-card, .feature-card, .scanner-area, .section-header, .stat-card, .history-item, .result-card'
      );
      targets.forEach((el) => {
        el.classList.add('reveal');
        observer.observe(el);
      });
    }, 100);

    return () => observer.disconnect();
  }, []);

  const handleNavigate = (section) => {
    setActiveSection(section);
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <BrutalDecorations />
      <Navbar activeSection={activeSection} onNavigate={handleNavigate} />
      <main>
        <Hero onNavigate={handleNavigate} />
        <div id="home"></div>
        <Scanner />
        <div id="scanner"></div>
        <LiveDeepfake />
        <div id="deepfake"></div>
        <Dashboard />
        <div id="dashboard"></div>
        <History />
        <div id="history"></div>
        <Education />
        <div id="education"></div>
      </main>
      <Footer />
    </>
  );
}
