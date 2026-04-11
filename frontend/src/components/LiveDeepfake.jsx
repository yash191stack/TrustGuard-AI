import React, { useRef, useState, useEffect } from 'react';
import './LiveDeepfake.css';

export default function LiveDeepfake() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [liveLogs, setLiveLogs] = useState([]);
  
  const [isLiveDetecting, setIsLiveDetecting] = useState(false);
  const isLiveRef = useRef(false);
  
  // Sliding window context (last 5 frames max)
  const windowRef = useRef([]);

  useEffect(() => {
    isLiveRef.current = isLiveDetecting;
  }, [isLiveDetecting]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      setError('');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported or blocked.");
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
    } catch (err) {
      setError(`Camera Error: ${err.message}`);
    }
  };

  const stopCamera = () => {
    setIsLiveDetecting(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    setResult(null);
    windowRef.current = [];
  };

  // Detects if the input is likely a digital screen (phone/laptop) pointing at the camera
  function detectScreen(pixels, width, height) {
    let rSum = 0, bSum = 0, pixCount = 0;
    
    // Sample the center region for screen glow characteristics
    for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8); y += 4) {
        for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 4) {
            const i = (y * width + x) * 4;
            rSum += pixels[i];     // Red
            bSum += pixels[i+2];   // Blue
            pixCount++;
        }
    }
    const rAvg = rSum / (pixCount || 1);
    const bAvg = bSum / (pixCount || 1);
    
    // High blue-to-red ratio indicates screen light rather than human skin reflection
    // And base brightness check
    if (bAvg > (rAvg * 0.85) && rAvg > 40) {
        return true; 
    }
    return false;
  }

  // Processes new raw result into the sliding window and evaluates the final aggregated state
  const pushToSlidingWindow = (rawResult) => {
    let currentWindow = windowRef.current;
    currentWindow.push(rawResult);
    
    // Keep only the last 5 results
    if (currentWindow.length > 5) {
      currentWindow.shift();
    }
    windowRef.current = currentWindow;

    // Aggregation Logic
    let fakeVotes = 0;
    let suspiciousVotes = 0;
    let realVotes = 0;
    let totalConfidence = 0;

    currentWindow.forEach(res => {
      totalConfidence += res.confidence;
      if (res.type === 'SCREEN') suspiciousVotes++;
      else if (res.type === 'FAKE') fakeVotes++;
      else realVotes++;
    });

    const avgConfidence = totalConfidence / currentWindow.length;
    const totalChecks = currentWindow.length;

    let finalStatus = 'Likely Real';
    let finalIsReal = true;
    let details = 'Face verified as historically consistent and authentic.';
    let cssTag = 'safe';

    // Rule: 4/5 Fake -> High Risk
    if (fakeVotes >= Math.ceil(totalChecks * 0.8)) {
       finalStatus = 'High Risk';
       finalIsReal = false;
       details = 'Deepfake or digital manipulation consistently detected.';
       cssTag = 'danger';
    } 
    // Rule: 3/5 Fake OR Screen -> Suspicious
    else if ((fakeVotes + suspiciousVotes) >= Math.ceil(totalChecks * 0.6)) {
       finalStatus = 'Suspicious';
       finalIsReal = false;
       details = suspiciousVotes > fakeVotes 
         ? 'Optical mismatch detected: Likely a screen recording (Presentation attack).'
         : 'Inconsistent frames detected. Could be a physical spoof or partial deepfake.';
       cssTag = 'warning';
    } 
    
    const aggregatedResult = {
      status: finalStatus,
      isReal: finalIsReal,
      confidence: avgConfidence,
      details: details,
      cssTag: cssTag
    };

    setResult(aggregatedResult);
    
    // Log timeline
    const timestamp = new Date().toLocaleTimeString();
    setLiveLogs(prev => [
      { 
        id: Date.now(), 
        time: timestamp, 
        status: finalStatus,
        confidence: avgConfidence,
        msg: details,
        rawType: rawResult.type,
        cssTag: cssTag
      },
      ...prev
    ].slice(0, 10));
  };

  const captureAndAnalyze = async (isSilent = false) => {
    if (!videoRef.current || !stream) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 240;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
    const frameData = canvas.toDataURL('image/jpeg', 0.8);
    
    if (!isSilent) setIsScanning(true);
    setError('');

    try {
      // Step 1: Pre-check Screen Detection
      const isScreen = detectScreen(imgData.data, canvas.width, canvas.height);

      if (isScreen) {
        // Log locally without API call to save bandwidth
        pushToSlidingWindow({ type: 'SCREEN', confidence: 0.85 });
      } else {
        // Step 2: Send to ML API
        const response = await fetch('http://localhost:5001/api/analyze/realtime-deepfake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frame: frameData })
        });
        
        let apiData;
        try {
           apiData = await response.json();
        } catch(e) {
           throw new Error("Invalid response from server.");
        }

        if (!response.ok || apiData.isError) {
           // Fallback mechanism on server error (Rule-based: assume suspicious if API down)
           pushToSlidingWindow({ type: 'SUSPICIOUS', confidence: 0.50 });
        } else {
           pushToSlidingWindow({ 
             type: apiData.isReal ? 'REAL' : 'FAKE', 
             confidence: apiData.confidence 
           });
        }
      }
    } catch (err) {
      console.error(err);
      // Fallback on network failure
      pushToSlidingWindow({ type: 'SUSPICIOUS', confidence: 0.50 });
    } finally {
      if (!isSilent) setIsScanning(false);
    }
  };

  const toggleLiveDetection = async () => {
    if (!isLiveDetecting) {
      setIsLiveDetecting(true);
      isLiveRef.current = true; 
      windowRef.current = []; // reset window on fresh start
      setResult(null);
      captureLoop();
    } else {
      setIsLiveDetecting(false);
      isLiveRef.current = false;
    }
  };

  const captureLoop = async () => {
    if (!isLiveRef.current || !videoRef.current || !stream) return;
    
    await captureAndAnalyze(true);
    
    if (isLiveRef.current) {
      // Periodic Frame Sampling (MANDATORY: 1 frame every 2.5 seconds)
      setTimeout(captureLoop, 2500); 
    }
  };

  return (
    <section id="livedeepfake" className="live-cam-section glass-card">
      <div className="live-cam-container">
        <h2 className="section-title">Live Deepfake Scanner</h2>
        <p className="section-desc">Real-time intelligent risk analysis using sampling and aggregation.</p>
        
        <div className="scanner-interface">
          <div className="video-container">
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {!stream ? (
              <div className="file-drop-zone">
                <i className="drop-icon fas fa-video"></i>
                <h3 className="drop-text">Enable Camera</h3>
                <p>Click below to start live stream</p>
                <button className="scan-button" style={{ marginTop: '2rem' }} onClick={startCamera}>
                  Start Camera
                </button>
              </div>
            ) : (
              <>
                 <div style={{ position: 'relative', width: '100%', border: 'var(--border-width) solid #fff' }}>
                   <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', background: '#000' }}></video>
                   
                   {(isLiveDetecting || isScanning) && (
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: '4px solid var(--accent-info)', pointerEvents: 'none' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--accent-info)', animation: 'scandown 2.5s linear infinite' }}></div>
                      </div>
                   )}
                 
                   {result && isLiveDetecting && (
                     <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#000', border: '3px solid', borderColor: result.cssTag === 'safe' ? 'var(--accent-safe)' : result.cssTag === 'warning' ? 'var(--accent-warn)' : 'var(--accent-alert)', color: '#fff', padding: '10px 20px', fontWeight: 900, textTransform: 'uppercase' }}>
                       {result.status}
                     </div>
                   )}
                 </div>

                 <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                   <button 
                     className="btn-primary" 
                     onClick={toggleLiveDetection}
                   >
                     {isLiveDetecting ? '⏹ Stop Live Detection' : '▶ Start Live Detection'}
                   </button>
                   <button className="btn-secondary" onClick={() => captureAndAnalyze(false)} disabled={isScanning || isLiveDetecting}>
                     {isScanning ? 'Analyzing...' : 'Single Frame Check'}
                   </button>
                   <button className="btn-secondary" onClick={stopCamera}>
                     Turn Off Camera
                   </button>
                 </div>
              </>
            )}
          </div>
          
          <div className="results-panel" style={{ padding: '2rem', background: '#000', border: 'var(--border-width) solid #fff' }}>
            <h3 style={{ textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '3px solid #fff', paddingBottom: '10px' }}>Analysis Output</h3>
            {error && <div style={{ background: 'var(--accent-alert)', color: '#fff', padding: '1rem', fontWeight: 900, border: '3px solid #fff' }}>{error}</div>}
            
            {result ? (
              <div style={{ 
                padding: '1.5rem', 
                border: '3px solid', 
                borderColor: result.cssTag === 'safe' ? 'var(--accent-safe)' : result.cssTag === 'warning' ? 'var(--accent-warn)' : 'var(--accent-alert)',
                background: 'rgba(255,255,255,0.05)',
                marginBottom: '2rem'
              }}>
                <h4 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>
                  {result.status} ({(result.confidence * 100).toFixed(0)}%)
                </h4>
                <div style={{ width: '100%', height: '20px', background: '#000', border: '2px solid #fff', marginBottom: '15px' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${result.confidence * 100}%`, 
                    background: result.cssTag === 'safe' ? 'var(--accent-safe)' : result.cssTag === 'warning' ? 'var(--accent-warn)' : 'var(--accent-alert)'
                  }}></div>
                </div>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-dim)' }}>{result.details}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px', textTransform: 'uppercase' }}>Mode: 5-Frame Sliding Window Aggregation</p>
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', border: '3px dashed #fff', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2rem' }}>
                {isScanning ? 'System Aggregating Data...' : (isLiveDetecting ? 'Live feed active. Awaiting window buffer...' : 'System Idle')}
              </div>
            )}

            {liveLogs.length > 0 && (
              <div>
                <h4 style={{ textTransform: 'uppercase', marginBottom: '10px', color: 'var(--accent-info)' }}>Sliding Window Log</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {liveLogs.map(log => (
                    <div key={log.id} style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      padding: '10px', 
                      borderLeft: '4px solid', 
                      borderColor: log.cssTag === 'safe' ? 'var(--accent-safe)' : log.cssTag === 'warning' ? 'var(--accent-warn)' : 'var(--accent-alert)',
                      background: 'rgba(0,0,0,0.5)',
                      fontSize: '0.9rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: '#fff' }}>
                        <span>[{log.time}] {log.status}</span>
                        <span>{(log.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Frame Result: {log.rawType} &rarr; {log.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
