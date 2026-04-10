import { useState } from 'react';
import ParticleBackground from './components/ParticleBackground';
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
        <LiveDeepfake />
        <Dashboard />
        <History />
        <Education />
      </main>
      <Footer />
    </>
  );
}
