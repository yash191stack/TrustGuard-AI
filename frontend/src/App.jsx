import { useState, useEffect } from 'react';
import ParticleBackground from './components/ParticleBackground';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Scanner from './components/Scanner';
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
            // Unobserve after revealing to prevent repeating animation when scrolling back up
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    // Give React a tiny tick to finish mounting elements before querySelect
    setTimeout(() => {
      const targets = document.querySelectorAll(
        '.glass-card, .feature-card, .scanner-area, .section-header, .stat-card, .history-item'
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
      <ParticleBackground />
      <Navbar activeSection={activeSection} onNavigate={handleNavigate} />
      <main>
        <Hero onNavigate={handleNavigate} />
        <Scanner />
        <Dashboard />
        <History />
        <Education />
      </main>
      <Footer />
    </>
  );
}
