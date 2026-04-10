import { useState } from 'react';
import './Education.css';

const threats = [
  {
    id: 'phishing',
    icon: '🎣',
    title: 'Phishing Attacks',
    color: '#ff4444',
    brief: 'Fake emails, messages, or websites that steal your personal information',
    details: 'Phishing is the most common form of cybercrime. Attackers create fake websites that look identical to legitimate ones (banks, social media, email providers) to trick you into entering your login credentials. They often use urgency ("Your account will be suspended!") or rewards ("You won a prize!") to manipulate you.',
    signs: ['Misspelled URLs (faceb00k.com)', 'Urgency in the message', 'Asks for passwords/OTP/PIN', 'Generic greetings like "Dear Customer"', 'Suspicious sender email address'],
    protection: ['Always check the URL carefully', 'Never share OTP or passwords', 'Enable two-factor authentication', 'Use browser safe browsing features', 'Report phishing to cybercrime.gov.in']
  },
  {
    id: 'scam',
    icon: '💰',
    title: 'Financial Scams',
    color: '#ff8800',
    brief: 'Fraudulent schemes to steal your money through fake investments, lottery, or emotional manipulation',
    details: 'Financial scams range from simple "send money urgently" messages from fake friends to sophisticated investment fraud schemes. In India, UPI fraud has become rampant — scammers send collect requests, fake QR codes, or impersonate bank officials to drain your account.',
    signs: ['Requests for urgent money transfer', 'Promises of unrealistic returns', 'Fake UPI collect requests', 'Unknown callers claiming to be bank officials', 'Pressure to act immediately'],
    protection: ['Never send money to unknown people', 'Verify caller identity independently', 'Never share UPI PIN or OTP', 'Don\'t scan unknown QR codes', 'Use official bank apps only']
  },
  {
    id: 'deepfake',
    icon: '🎭',
    title: 'Deepfake Content',
    color: '#a855f7',
    brief: 'AI-generated fake videos, audio, or images that look incredibly realistic',
    details: 'Deepfakes use artificial intelligence to create hyper-realistic fake content. A deepfake video can make anyone appear to say anything. Voice cloning can replicate someone\'s voice from just a few seconds of audio. These are used for fraud, misinformation, and identity theft.',
    signs: ['Unnatural facial movements or blinking', 'Audio-lip sync mismatches', 'Inconsistent lighting/shadows', 'Blurry edges around face/body', 'Calls from "known people" asking for money'],
    protection: ['Video-verify caller identity', 'Be skeptical of shocking videos', 'Use reverse image search', 'Check multiple sources', 'Use TrustGuard AI to analyze media']
  },
  {
    id: 'social',
    icon: '🧠',
    title: 'Social Engineering',
    color: '#00d4ff',
    brief: 'Psychological manipulation to trick you into revealing confidential information',
    details: 'Social engineering exploits human psychology rather than technical vulnerabilities. Attackers build trust, create urgency, or use authority to manipulate victims. This includes pretexting (creating a fabricated scenario), baiting (offering something enticing), and quid pro quo (offering a service in exchange for information).',
    signs: ['Creates false sense of urgency', 'Appeals to authority or trust', 'Asks you to keep it secret', 'Too-good-to-be-true offers', 'Plays on emotions (fear, greed, curiosity)'],
    protection: ['Take time before acting', 'Verify through separate channels', 'Never share confidential info', 'Be wary of unsolicited contacts', 'Trust your instincts']
  },
  {
    id: 'malware',
    icon: '🦠',
    title: 'Malware & Ransomware',
    color: '#ff0044',
    brief: 'Malicious software that damages your device, steals data, or locks your files for ransom',
    details: 'Malware includes viruses, trojans, ransomware, spyware, and keyloggers. It can be spread through email attachments, fake apps, infected websites, or USB drives. Ransomware specifically encrypts all your files and demands payment (often in cryptocurrency) for the decryption key.',
    signs: ['Unexpected file downloads', 'Device running unusually slow', 'Pop-ups and redirects', 'Unusual data usage', 'Files becoming inaccessible'],
    protection: ['Keep software updated', 'Don\'t download from untrusted sources', 'Use reputable antivirus', 'Backup your data regularly', 'Don\'t open suspicious email attachments']
  }
];

export default function Education() {
  const [activeCard, setActiveCard] = useState(null);

  return (
    <section className="education" id="education">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title"><span className="title-icon">🎓</span> Threat <span className="gradient-text">Education</span></h2>
          <p className="section-desc">Learn about the most common cyber threats and how to protect yourself</p>
        </div>

        <div className="edu-grid">
          {threats.map((threat) => (
            <div
              key={threat.id}
              className={`edu-card glass-card ${activeCard === threat.id ? 'expanded' : ''}`}
              onClick={() => setActiveCard(activeCard === threat.id ? null : threat.id)}
            >
              <div className="edu-card-header">
                <div className="edu-icon" style={{ background: `${threat.color}15`, border: `1px solid ${threat.color}30` }}>
                  {threat.icon}
                </div>
                <div className="edu-card-info">
                  <h3 style={{ color: threat.color }}>{threat.title}</h3>
                  <p>{threat.brief}</p>
                </div>
                <div className={`edu-expand ${activeCard === threat.id ? 'open' : ''}`}>▼</div>
              </div>

              {activeCard === threat.id && (
                <div className="edu-card-body fade-in">
                  <div className="edu-description">{threat.details}</div>

                  <div className="edu-columns">
                    <div className="edu-column">
                      <h4 className="edu-column-title">🚩 Warning Signs</h4>
                      <ul>
                        {threat.signs.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                    <div className="edu-column">
                      <h4 className="edu-column-title">🛡️ How to Protect</h4>
                      <ul>
                        {threat.protection.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
