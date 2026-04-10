import React, { useRef, useState, useEffect } from 'react';
import './LiveDeepfake.css';

export default function LiveDeepfake() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  
  const [isLiveDetecting, setIsLiveDetecting] = useState(false);
  const isLiveRef = useRef(false);

  useEffect(() => {
    isLiveRef.current = isLiveDetecting;
  }, [isLiveDetecting]);

  const startCamera = async () => {
    try {
      setError('');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia is not supported in this browser. Ensure you are using localhost or HTTPS.");
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
    } catch (err) {
      setError(`Camera Error: ${err.name || 'Unknown'} - ${err.message || 'Permission denied or not available.'}`);
      console.error("Camera error:", err);
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
  };

  const captureAndAnalyze = async (isSilent = false) => {
    if (!videoRef.current || !stream) return;
    
    // Capture a frame from video
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    const frameData = canvas.toDataURL('image/jpeg', 0.8);
    
    if (!isSilent) setIsScanning(true);
    if (!isSilent) setResult(null);
    setError('');

    try {
      const response = await fetch('http://localhost:5001/api/analyze/realtime-deepfake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: frameData })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze frame');
      }
      
      setResult(data);
    } catch (err) {
      setError(err.message);
      setIsLiveDetecting(false); 
      isLiveRef.current = false; // synchronously halt loop
    } finally {
      if (!isSilent) setIsScanning(false);
    }
  };

  const toggleLiveDetection = async () => {
    if (!isLiveDetecting) {
      setIsLiveDetecting(true);
      captureLoop();
    } else {
      setIsLiveDetecting(false);
    }
  };

  const captureLoop = async () => {
    if (!isLiveRef.current || !videoRef.current || !stream) return;
    
    await captureAndAnalyze(true);
    
    // Continue loop if still detecting
    if (isLiveRef.current) {
      setTimeout(captureLoop, 3000);
    }
  };

  return (
    <section id="livedeepfake" className="live-cam-section">
      <div className="live-cam-container">
        <h2>Live Deepfake Scanner</h2>
        <p>Real-time AI manipulation detection using Araya API</p>
        
        <div className="scanner-interface">
          <div className="video-container">
            {/* hidden canvas for frame capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {!stream ? (
              <div className="camera-placeholder">
                <i className="fas fa-camera"></i>
                <p>Click "Start Camera" to enable live scan</p>
                <button className="primary-btn" onClick={startCamera}>
                  <i className="fas fa-play"></i> Start Camera
                </button>
              </div>
            ) : (
              <>
                 <video ref={videoRef} autoPlay playsInline muted className="live-video"></video>
                 
                 {/* Live Caption Popup */}
                 {result && isLiveDetecting && (
                   <div className={`live-caption ${result.isReal ? 'real' : 'fake'}`}>
                     <span className="live-caption-icon">
                        {result.isReal ? '✅' : '⚠️'}
                     </span>
                     {result.isReal ? 'Live: REAL' : 'Live: DEEPFAKE'}
                   </div>
                 )}

                 <div className="camera-controls">
                   <button 
                     className={`capture-btn ${isLiveDetecting ? 'active' : ''}`} 
                     onClick={toggleLiveDetection}
                   >
                     {isLiveDetecting ? 'Stop Live Detection' : 'Start Live Detection'}
                   </button>
                   <button className="secondary-btn" onClick={() => captureAndAnalyze(false)} disabled={isScanning || isLiveDetecting}>
                     {isScanning ? 'Analyzing...' : 'Manual Scan Check'}
                   </button>
                   <button className="stop-btn" onClick={stopCamera}>
                     Stop Camera
                   </button>
                 </div>
              </>
            )}
          </div>
          
          <div className="results-panel">
            <h3>Analysis Result</h3>
            {error && <div className="error-message">{error}</div>}
            
            {result ? (
              <div className={`result-card ${result.isReal ? 'real' : 'fake'}`}>
                <div className="result-icon">
                  <i className={result.isReal ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle'}></i>
                </div>
                <h4>{result.isReal ? 'Likely Real' : 'Deepfake Detected'}</h4>
                <div className="confidence-meter">
                  <div className="meter-label">
                    <span>Confidence</span>
                    <span>{(result.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="meter-bar">
                    <div 
                      className={`meter-fill ${result.isReal ? 'safe-bg' : 'danger-bg'}`}
                      style={{ width: `${result.confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
                {result.details && <p className="result-details">{result.details}</p>}
                {result.notice && <p className="result-notice"><small>{result.notice}</small></p>}
              </div>
            ) : (
              <div className="waiting-state">
                {isScanning ? (
                  <div className="scanning-animation">
                    <div className="pulse-ring"></div>
                    <p>Analyzing frame with Araya.ai...</p>
                  </div>
                ) : (
                  <p className="idle-text">
                    {stream ? 
                      (isLiveDetecting ? 'Live detection running. Waiting for result...' : 'Click "Start Live Detection" or "Manual Scan Check"') 
                      : 'Waiting for camera...'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
