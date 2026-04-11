export default function BrutalDecorations() {
  return (
    <div className="brutal-decorations" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 0,
      overflow: 'hidden',
    }}>
      {/* Dynamic Glow Points to tackle "too dark" feel */}
      <div style={{ position: 'absolute', top: '-10%', left: '50%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(0, 224, 255, 0.05) 0%, transparent 70%)', transform: 'translateX(-50%)' }}></div>
      <div style={{ position: 'absolute', bottom: '-10%', left: '10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(0, 255, 159, 0.03) 0%, transparent 70%)' }}></div>

      {/* Corner Markers - Brighter White */}
      <div style={{ position: 'absolute', top: '30px', left: '30px', width: '60px', height: '60px', borderTop: '6px solid #fff', borderLeft: '6px solid #fff' }}></div>
      <div style={{ position: 'absolute', top: '30px', right: '30px', width: '60px', height: '60px', borderTop: '6px solid #fff', borderRight: '6px solid #fff' }}></div>
      <div style={{ position: 'absolute', bottom: '30px', left: '30px', width: '60px', height: '60px', borderBottom: '6px solid #fff', borderLeft: '6px solid #fff' }}></div>
      <div style={{ position: 'absolute', bottom: '30px', right: '30px', width: '60px', height: '60px', borderBottom: '6px solid #fff', borderRight: '6px solid #fff' }}></div>

      {/* Vertical Side Lines - Brighter Cyan */}
      <div style={{ position: 'absolute', top: '150px', left: '15px', bottom: '150px', width: '3px', background: 'var(--accent-info)', boxShadow: '0 0 15px var(--accent-info)' }}></div>
      <div style={{ position: 'absolute', top: '150px', right: '15px', bottom: '150px', width: '3px', background: 'var(--accent-info)', boxShadow: '0 0 15px var(--accent-info)' }}></div>

      {/* Floating Meta-Data */}
      <div style={{ position: 'absolute', top: '100px', left: '40px', fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '12px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>
        LATENCY: 24MS // STATUS: CONNECTED
      </div>
      <div style={{ position: 'absolute', bottom: '100px', right: '40px', fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '12px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>
        ENCRYPTION: AES-256 // V_2.4.0
      </div>

      {/* Large Technical Grid Circles */}
      <div style={{ position: 'absolute', top: '20%', right: '-100px', width: '400px', height: '400px', border: '1px solid rgba(0, 224, 255, 0.1)', borderRadius: '50%' }}></div>
      <div style={{ position: 'absolute', bottom: '10%', left: '-100px', width: '300px', height: '300px', border: '1px solid rgba(0, 255, 159, 0.1)', borderRadius: '50%' }}></div>
    </div>
  );
}
