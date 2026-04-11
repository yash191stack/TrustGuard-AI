import React, { useRef, useState, useEffect, useCallback } from 'react';
import './LiveDeepfake.css';

/**
 * TRUSTGUARD AI — SENTINEL CORE V20
 * Exact implementation of the 6-step detection pipeline.
 *
 * STEP 1: Frame preprocessing (FaceMesh crop + grayscale + diff)
 * STEP 2: 5 parallel signal detectors
 * STEP 3: Weighted fake_score (0–100)
 * STEP 4: 15-frame rolling buffer smoothing (no verdict until 5 frames)
 * STEP 5: Hysteresis decision gate (REAL/SUSPICIOUS/FAKE/ANALYZING)
 * STEP 6: Top-3 explanation engine
 */

// ─── CONSTANTS (exact spec) ───────────────────────────────────
const WEIGHTS       = { blink: 0.10, screen: 0.50, motion: 0.20, texture: 0.10, geometry: 0.10 };
const SIGNAL_MAX    = { blink: 30, screen: 35, motion: 20, texture: 15, geometry: 10 };
const BUFFER_SIZE   = 15;
const MIN_FRAMES    = 5;   // must have this many before issuing a verdict
const CAPTURE_MS    = 250; // ~300ms interval

// Hysteresis thresholds (V21 — wider REAL zone, prevents false SUSPICIOUS on real faces)
const HYS = {
  fromReal:       { toFake: 68, toSuspicious: 52 },
  fromFake:       { toSuspicious: 50, toReal: 38 },
  fromSuspicious: { toFake: 68, toReal: 38 },
};

// Auto-calibration state (module-level so it persists across renders)
let baselineScreenScores = [];
let calibrationDone      = false;
let screenBaseline       = 0;

// MediaPipe FaceMesh eye landmark indices
const LEFT_EYE  = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const LIPS      = { top: 13, bottom: 14 };

export default function LiveDeepfake() {
  // ─── REFS ────────────────────────────────────────────────────
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const fmRef      = useRef(null);       // FaceMesh instance
  const loopRef    = useRef(null);
  const isLiveRef  = useRef(false);
  const frameIdxRef = useRef(0);

  // Rolling detection state
  const scoreBuffer    = useRef([]);     // smoothed fake_score history
  const stateRef       = useRef('ANALYZING');
  const blinkTimestamps = useRef([]);
  const prevPixelsRef  = useRef(null);
  const prevLandmarks  = useRef(null);
  const prevLipGap     = useRef(null);
  const latestLM       = useRef(null);   // latest FaceMesh landmarks
  const faceDetected   = useRef(false);
  const lowScoreStreakRef = useRef(0); // V23 Sticky State tracker

  // ─── STATE ───────────────────────────────────────────────────
  const [stream,      setStream]      = useState(null);
  const [isLive,      setIsLive]      = useState(false);
  const [fmReady,     setFmReady]     = useState(false);
  const [output,      setOutput]      = useState(null);  // full output JSON
  const [error,       setError]       = useState('');

  // ─── FACEMESH INIT ───────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        if (window.FaceMesh) {
          const fm = new window.FaceMesh({
            locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
          });
          fm.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          fm.onResults(results => {
            if (results.multiFaceLandmarks?.length > 0) {
              latestLM.current = results.multiFaceLandmarks[0];
              faceDetected.current = true;
            } else {
              latestLM.current = null;
              faceDetected.current = false;
            }
          });
          fmRef.current = fm;
          console.log('[V20] FaceMesh loaded');
        }
      } catch(e) { console.warn('[V20] FaceMesh unavailable, degraded mode'); }
      setFmReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  // ─── CAMERA ──────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      setStream(ms);
    } catch(e) { setError(`Camera: ${e.message}`); }
  };

  const stopAll = () => {
    setIsLive(false);
    isLiveRef.current = false;
    clearTimeout(loopRef.current);
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setOutput(null);
    scoreBuffer.current = [];
    stateRef.current = 'ANALYZING';
    blinkTimestamps.current = [];
    prevPixelsRef.current = null;
    prevLandmarks.current = null;
    prevLipGap.current = null;
    frameIdxRef.current = 0;
    lowScoreStreakRef.current = 0;
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 2 — SIGNAL DETECTORS
  // ─────────────────────────────────────────────────────────────

  /** Signal 1: BLINK RATE [0–30] */
  const signalBlink = (landmarks) => {
    if (!landmarks) return SIGNAL_MAX.blink * 0.3; // no face = slightly suspicious

    const ear = (lm, idx) => {
      const p = idx.map(i => lm[i]);
      const v1 = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y);
      const v2 = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y);
      const h  = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y);
      return (v1 + v2) / (2 * h + 1e-6);
    };

    const avgEAR = (ear(landmarks, LEFT_EYE) + ear(landmarks, RIGHT_EYE)) / 2;
    const now = Date.now();

    if (avgEAR < 0.20) {
      blinkTimestamps.current.push(now);
    }
    // Keep only last 10 seconds
    blinkTimestamps.current = blinkTimestamps.current.filter(t => now - t < 10000);
    const blinksInWindow = blinkTimestamps.current.length;
    const framesElapsed = frameIdxRef.current;

    // Don't evaluate until we have 10s of data (~40 frames at 250ms)
    if (framesElapsed < 20) return 0;

    // 0–2 blinks/10s = abnormal (too few)
    if (blinksInWindow === 0) return SIGNAL_MAX.blink * 1.0;   // 30
    if (blinksInWindow <= 2)  return SIGNAL_MAX.blink * 0.7;   // 21
    if (blinksInWindow > 12)  return SIGNAL_MAX.blink * 0.5;   // 15 (too many)
    return 0; // 3–12 blinks = normal
  };

  /** Signal 2: SCREEN DETECTION [0–35] — Laplacian + Cyan + Bezel + Moire */
  const signalScreen = (imageData) => {
    const d = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    let score = 0;

    // A. CENTER-FOCUSED Laplacian VARIANCE
    // Focusing on the center 50% to ignore background brick walls/textures
    const cx = Math.floor(w * 0.25);
    const cy = Math.floor(h * 0.25);
    const cw = Math.floor(w * 0.50);
    const ch = Math.floor(h * 0.50);

    const lapValues = [];
    for (let y = cy + 1; y < cy + ch - 1; y += 2) {
      for (let x = cx + 1; x < cx + cw - 1; x += 2) {
        const i     = (y * w + x) * 4;
        const iTop  = ((y - 1) * w + x) * 4;
        const iBot  = ((y + 1) * w + x) * 4;
        const iLeft = (y * w + (x - 1)) * 4;
        const iRgt  = (y * w + (x + 1)) * 4;

        const gray   = (d[i]     * 76 + d[i+1]   * 150 + d[i+2]   * 29) >> 8;
        const top    = (d[iTop]  * 76 + d[iTop+1] * 150 + d[iTop+2] * 29) >> 8;
        const bottom = (d[iBot]  * 76 + d[iBot+1] * 150 + d[iBot+2] * 29) >> 8;
        const left   = (d[iLeft] * 76 + d[iLeft+1] * 150 + d[iLeft+2] * 29) >> 8;
        const right  = (d[iRgt]  * 76 + d[iRgt+1] * 150 + d[iRgt+2] * 29) >> 8;
        
        lapValues.push(Math.abs(4 * gray - top - bottom - left - right));
      }
    }
    const lapMean = lapValues.reduce((a, b) => a + b, 0) / (lapValues.length || 1);
    const lapVar  = lapValues.reduce((s, v) => s + (v - lapMean) ** 2, 0) / (lapValues.length || 1);
    
    let lapScore = 0;
    if      (lapVar < 80)  lapScore = SIGNAL_MAX.screen * 0.85; 
    else if (lapVar < 150) lapScore = SIGNAL_MAX.screen * 0.55;
    else if (lapVar < 250) lapScore = SIGNAL_MAX.screen * 0.25;
    else if (lapVar < 350) lapScore = SIGNAL_MAX.screen * 0.05;
    score += lapScore;

    // B. CYAN / TEAL DETECTION (Approach B)
    // Catching the specific glow often seen on phone screens in the demo
    let cyanPixels = 0, totalSampled = 0;
    for (let i = 0; i < d.length; i += 40) {
      const r = d[i], g = d[i+1], b = d[i+2];
      if (b > 150 && g > 140 && r < 130 && b > r + 30) {
        cyanPixels++;
      } else if (r > 190 && g > 190 && b > 190) { // white glare
        cyanPixels++;
      }
      totalSampled++;
    }
    const cyanRatio = cyanPixels / (totalSampled + 1);
    let cyanScore = 0;
    if      (cyanRatio > 0.08) cyanScore = SIGNAL_MAX.screen * 0.7;
    else if (cyanRatio > 0.04) cyanScore = SIGNAL_MAX.screen * 0.4;
    else if (cyanRatio > 0.02) cyanScore = SIGNAL_MAX.screen * 0.2;
    score += cyanScore;

    // C. BEZEL / BORDER DETECTION (Approach C)
    // Detecting the dark rectangle of the phone frame
    let leftDark = 0, leftTotal = 0;
    for (let y = 0; y < h; y += 4) {
      for (let x = w*0.15; x < w*0.25; x += 3) {
        const i = (y * w + Math.floor(x)) * 4;
        const lum = (d[i] + d[i+1] + d[i+2]) / 3;
        if (lum < 40) leftDark++;
        leftTotal++;
      }
    }
    let rightDark = 0, rightTotal = 0;
    for (let y = 0; y < h; y += 4) {
      for (let x = w*0.75; x < w*0.85; x += 3) {
        const i = (y * w + Math.floor(x)) * 4;
        const lum = (d[i] + d[i+1] + d[i+2]) / 3;
        if (lum < 40) rightDark++;
        rightTotal++;
      }
    }
    const leftRatio = leftDark / (leftTotal + 1);
    const rightRatio = rightDark / (rightTotal + 1);
    let bezelScore = 0;
    if (leftRatio > 0.4 && rightRatio > 0.4) bezelScore = SIGNAL_MAX.screen * 0.8;
    else if (leftRatio > 0.25 || rightRatio > 0.25) bezelScore = SIGNAL_MAX.screen * 0.4;
    score += bezelScore;

    // D. MOIRE / FREQUENCY SCAN (Existing)
    let hfHits = 0;
    for (let y = cy; y < cy + ch; y += 6) {
      for (let x = cx; x < cx + cw; x += 4) {
        const ci = (y * w + x) * 4;
        const lg = (d[ci-4] + d[ci-3] + d[ci-2]) / 3;
        const rg = (d[ci+4] + d[ci+5] + d[ci+6]) / 3;
        const cg = (d[ci] + d[ci+1] + d[ci+2]) / 3;
        if (Math.abs(cg - lg) > 12 && Math.abs(cg - rg) > 12) hfHits++;
      }
    }
    if (hfHits > 1000) score += 8;

    // E. DARK BEZEL RATIO (Catching phone body/frame)
    let darkPixels = 0, totalPixels = 0;
    for (let i = 0; i < d.length; i += 40) {
      const lum = (d[i] + d[i+1] + d[i+2]) / 3;
      if (lum < 35) darkPixels++; // very dark = phone bezel
      totalPixels++;
    }
    const darkRatio = darkPixels / (totalPixels + 1);
    if      (darkRatio > 0.45) score += SIGNAL_MAX.screen * 0.9; // 31.5
    else if (darkRatio > 0.30) score += SIGNAL_MAX.screen * 0.6; // 21
    else if (darkRatio > 0.20) score += SIGNAL_MAX.screen * 0.3; // 10.5

    if (frameIdxRef.current % 10 === 0) {
      console.log(`[SCREEN DET] lapVar:${lapVar.toFixed(0)} cyan:${(cyanRatio*100).toFixed(1)}% bezel:L${(leftRatio*100).toFixed(0)}R${(rightRatio*100).toFixed(0)} dark:${(darkRatio*100).toFixed(1)}% score:${score.toFixed(1)}`);
    }

    const rawScore = Math.min(score, SIGNAL_MAX.screen);

    // Auto-calibration: first 20 frames establish real-face baseline
    if (!calibrationDone && frameIdxRef.current <= 20) {
      baselineScreenScores.push(rawScore);
      if (frameIdxRef.current === 20) {
        screenBaseline  = baselineScreenScores.reduce((a, b) => a + b, 0) / baselineScreenScores.length;
        calibrationDone = true;
        console.log(`[V21] Screen baseline calibrated: ${screenBaseline.toFixed(1)}`);
      }
      return rawScore; // raw during calibration
    }

    // Post-calibration: only score ABOVE baseline is suspicious
    if (calibrationDone) {
      const delta = rawScore - screenBaseline;
      if (delta <  3)  return Math.max(0, rawScore * 0.35); // same as baseline = REAL
      if (delta <  7)  return rawScore * 0.70;
      if (delta < 11)  return rawScore * 0.90;
    }

    return rawScore;
  };

  /** Signal 3: MOTION PATTERN [0–20] */
  const signalMotion = (imageData) => {
    const d = imageData.data;
    if (!prevPixelsRef.current) {
      prevPixelsRef.current = new Uint8Array(d);
      return 0;
    }

    // Sample more densely for variance calculation
    const diffs = [];
    for (let i = 0; i < d.length; i += 80) {
      diffs.push(Math.abs(d[i] - prevPixelsRef.current[i]));
    }
    prevPixelsRef.current = new Uint8Array(d);
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const diffVar = diffs.reduce((s, v) => s + (v - avgDiff) ** 2, 0) / diffs.length;

    // Completely static frame = photo or frozen screen
    if (avgDiff < 0.8)                      return SIGNAL_MAX.motion * 0.85; // 17
    // KEY FIX: stabilized screen video — low avg + low spatial variance
    if (avgDiff < 2.0 && diffVar < 10)      return SIGNAL_MAX.motion * 0.65; // 13
    // Uniform panning motion (screen being moved)
    if (avgDiff > 5   && diffVar < 8)       return SIGNAL_MAX.motion * 0.55; // 11
    // Large chaotic motion = phone being held
    if (avgDiff > 35)                       return SIGNAL_MAX.motion * 0.60; // 12
    // Natural face: 0.3–35 avgDiff with spatial variance > 5  → 0 score
    return 0;
  };

  /** Signal 4: TEXTURE ARTIFACT [0–15] — LBP-like entropy + JPEG blocking */
  const signalTexture = (imageData) => {
    const d = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    let edgeSum = 0, edgeCount = 0;
    let blockArtifacts = 0, blockChecks = 0;

    // Laplacian-like edge variance (high = rich texture = real skin)
    for (let y = 2; y < h - 2; y += 4) {
      for (let x = 2; x < w - 2; x += 4) {
        const i = (y * w + x) * 4;
        const g = (d[i] + d[i+1] + d[i+2]) / 3;
        const t = ((d[i - w*4] + d[i - w*4+1] + d[i - w*4+2]) / 3);
        const b = ((d[i + w*4] + d[i + w*4+1] + d[i + w*4+2]) / 3);
        edgeSum += Math.abs(4 * g - t - b - ((d[i-4]+d[i-3]+d[i-2])/3) - ((d[i+4]+d[i+5]+d[i+6])/3));
        edgeCount++;
      }
    }
    const avgEdge = edgeCount > 0 ? edgeSum / edgeCount : 0;

    // JPEG 8x8 blocking artifacts detection
    for (let y = 0; y < h - 8; y += 8) {
      for (let x = 0; x < w - 8; x += 8) {
        const i1 = ((y + 7) * w + x + 4) * 4;
        const i2 = ((y + 8) * w + x + 4) * 4;
        if (i2 < d.length) {
          const diff = Math.abs(d[i1] - d[i2]);
          if (diff > 20) blockArtifacts++;
          blockChecks++;
        }
      }
    }
    const blockRatio = blockChecks > 0 ? blockArtifacts / blockChecks : 0;

    let score = 0;
    // Over-smooth (generative skin): very low edge
    if (avgEdge < 4)  score += SIGNAL_MAX.texture * 0.9;   // 13.5
    else if (avgEdge < 8) score += SIGNAL_MAX.texture * 0.5; // 7.5

    // JPEG blocking
    if (blockRatio > 0.25) score += SIGNAL_MAX.texture * 0.4; // 6
    else if (blockRatio > 0.15) score += SIGNAL_MAX.texture * 0.2;

    return Math.min(score, SIGNAL_MAX.texture);
  };

  /** Signal 5: FACIAL GEOMETRY [0–10] — landmark jitter + lip sync */
  const signalGeometry = (landmarks) => {
    if (!landmarks || !prevLandmarks.current) {
      prevLandmarks.current = landmarks;
      return 0;
    }

    // Jitter over 5 anchor points
    const anchors = [1, 152, 10, 234, 454]; // nose, chin, forehead, cheeks
    let jitterSum = 0;
    for (const idx of anchors) {
      const c = landmarks[idx], p = prevLandmarks.current[idx];
      if (c && p) jitterSum += Math.hypot(c.x - p.x, c.y - p.y);
    }
    prevLandmarks.current = landmarks;
    const avgJitter = jitterSum / anchors.length;

    // Lip sync jump
    let lipScore = 0;
    if (landmarks[LIPS.top] && landmarks[LIPS.bottom]) {
      const lipGap = Math.abs(landmarks[LIPS.top].y - landmarks[LIPS.bottom].y);
      if (prevLipGap.current !== null) {
        const change = Math.abs(lipGap - prevLipGap.current);
        if (change > 0.05) lipScore = SIGNAL_MAX.geometry * 0.6;
      }
      prevLipGap.current = lipGap;
    }

    let jitterScore = 0;
    // Jitter > 0.015 with no real head movement = screen video artifact
    if (avgJitter > 0.018) jitterScore = SIGNAL_MAX.geometry * 0.8;
    else if (avgJitter > 0.010) jitterScore = SIGNAL_MAX.geometry * 0.4;
    // Perfectly still (deepfake or static image)
    else if (avgJitter < 0.0004 && frameIdxRef.current > 15) jitterScore = SIGNAL_MAX.geometry * 0.5;

    return Math.min(jitterScore + lipScore, SIGNAL_MAX.geometry);
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 3 — WEIGHTED SCORE
  // ─────────────────────────────────────────────────────────────
  const computeFakeScore = (sigs) => {
    // Normalize each signal to 0–1 then multiply by 100
    const score =
      (sigs.blink    / SIGNAL_MAX.blink)    * WEIGHTS.blink    * 100 +
      (sigs.screen   / SIGNAL_MAX.screen)   * WEIGHTS.screen   * 100 +
      (sigs.motion   / SIGNAL_MAX.motion)   * WEIGHTS.motion   * 100 +
      (sigs.texture  / SIGNAL_MAX.texture)  * WEIGHTS.texture  * 100 +
      (sigs.geometry / SIGNAL_MAX.geometry) * WEIGHTS.geometry * 100;
    return Math.min(Math.round(score), 100);
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 5 — HYSTERESIS DECISION GATE
  // ─────────────────────────────────────────────────────────────
  const applyHysteresis = (smoothed) => {
    const cur = stateRef.current;
    let next = cur;

    if (cur === 'REAL' || cur === 'ANALYZING') {
      if      (smoothed > 65) next = 'FAKE';
      else if (smoothed > 52) next = 'SUSPICIOUS';
      else                    next = 'REAL';
      lowScoreStreakRef.current = 0;

    } else if (cur === 'FAKE') {
      if (smoothed < 42) {
        lowScoreStreakRef.current++;
        // Requires 8 consecutive frames of low score to drop to REAL
        next = lowScoreStreakRef.current >= 8 ? 'REAL' : 'FAKE';
      } else if (smoothed < 52) {
        next = 'SUSPICIOUS';
        lowScoreStreakRef.current = 0;
      } else {
        next = 'FAKE';
        lowScoreStreakRef.current = 0;
      }

    } else { // SUSPICIOUS
      if (smoothed > 60) {
        next = 'FAKE';
        lowScoreStreakRef.current = 0;
      } else if (smoothed < 42) {
        lowScoreStreakRef.current++;
        // Requires 6 consecutive frames of low score to drop to REAL
        next = lowScoreStreakRef.current >= 6 ? 'REAL' : 'SUSPICIOUS';
      } else {
        next = 'SUSPICIOUS';
        lowScoreStreakRef.current = 0;
      }
    }

    stateRef.current = next;
    return next;
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 6 — EXPLANATION ENGINE
  // ─────────────────────────────────────────────────────────────
  const buildReasons = (sigs, verdict) => {
    const candidates = [
      { score: sigs.screen / SIGNAL_MAX.screen * 100, threshold: 60, text: 'Screen-based content detected (moire/glow pattern)' },
      { score: sigs.screen / SIGNAL_MAX.screen * 100, threshold: 40, text: 'Uniform lighting pattern detected (no face shadows)' },
      { score: sigs.blink  / SIGNAL_MAX.blink  * 100, threshold: 50, text: 'Abnormal or absent blinking detected' },
      { score: sigs.motion / SIGNAL_MAX.motion * 100, threshold: 60, text: 'Unnatural motion pattern observed' },
      { score: sigs.motion / SIGNAL_MAX.motion * 100, threshold: 40, text: 'Motion inconsistent with a live face' },
      { score: sigs.texture/ SIGNAL_MAX.texture* 100, threshold: 50, text: 'Compression artifacts detected in face region' },
      { score: sigs.geometry/SIGNAL_MAX.geometry*100, threshold: 50, text: 'Facial landmark instability detected' },
    ]
    .filter(c => c.score >= c.threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(c => c.text);

    if (candidates.length === 0) {
      if (verdict === 'REAL') return ['All biometric signals within normal range', 'Natural blink rate detected', 'Live face texture confirmed'];
      return ['Analyzing biometric patterns...'];
    }
    return candidates;
  };

  // ─────────────────────────────────────────────────────────────
  // MAIN FRAME ANALYSIS
  // ─────────────────────────────────────────────────────────────
  const analyzeFrame = useCallback(async () => {
    if (!videoRef.current || !stream) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width  = 320;
    canvas.height = 240;
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    const imageData = ctx.getImageData(0, 0, 320, 240);

    frameIdxRef.current++;

    // Send to FaceMesh (non-blocking, uses latest result)
    if (fmRef.current && videoRef.current.readyState >= 2) {
      try { await fmRef.current.send({ image: videoRef.current }); } catch(e) {}
    }
    const lm = latestLM.current;

    // ── STEP 2: Extract all 5 signals in parallel ──
    const sigs = {
      blink:    signalBlink(lm),
      screen:   signalScreen(imageData),
      motion:   signalMotion(imageData),
      texture:  signalTexture(imageData),
      geometry: signalGeometry(lm),
    };

    // ── STEP 3: Weighted fake score ──
    const fake_score = computeFakeScore(sigs);

    // ── STEP 4: Rolling buffer + smoothed score ──
    scoreBuffer.current = [...scoreBuffer.current, fake_score].slice(-BUFFER_SIZE);
    const bufferReady = scoreBuffer.current.length >= MIN_FRAMES;
    const smoothed_score = bufferReady
      ? Math.round(scoreBuffer.current.reduce((s,v) => s+v, 0) / scoreBuffer.current.length)
      : fake_score;

    // ── STEP 5: Hysteresis gate ──
    const verdict = bufferReady ? applyHysteresis(smoothed_score) : 'ANALYZING';

    // ── Confidence: based on buffer score variance ──
    let confidence = 'LOW';
    if (scoreBuffer.current.length >= MIN_FRAMES) {
      const avg = smoothed_score;
      const variance = scoreBuffer.current.reduce((s,v) => s + (v-avg)**2, 0) / scoreBuffer.current.length;
      if (variance < 50) confidence = 'HIGH';
      else if (variance < 150) confidence = 'MEDIUM';
    }

    // ── STEP 6: Reasons ──
    const reasons = bufferReady ? buildReasons(sigs, verdict) : ['Calibrating sensors...'];

    // ── Build full output object ──
    const fullOutput = {
      verdict,
      fake_score,
      smoothed_score,
      confidence,
      signals: {
        blink:    Math.round(sigs.blink),
        screen:   Math.round(sigs.screen),
        motion:   Math.round(sigs.motion),
        texture:  Math.round(sigs.texture),
        geometry: Math.round(sigs.geometry),
      },
      reasons,
      frame_count: frameIdxRef.current,
      buffer_ready: bufferReady,
      buffer_depth: scoreBuffer.current.length,
    };

    setOutput(fullOutput);

    // DEBUG: log every 5 frames — open browser console to see live signal values
    if (frameIdxRef.current % 5 === 0) {
      console.log(
        `[V21 FRAME ${frameIdxRef.current}]`,
        `| SCREEN: ${Math.round(sigs.screen)}/${SIGNAL_MAX.screen}`,
        `| MOTION: ${Math.round(sigs.motion)}/${SIGNAL_MAX.motion}`,
        `| TEXTURE: ${Math.round(sigs.texture)}/${SIGNAL_MAX.texture}`,
        `| BLINK: ${Math.round(sigs.blink)}/${SIGNAL_MAX.blink}`,
        `| FAKE_SCORE: ${fake_score}`,
        `| SMOOTHED: ${smoothed_score}`,
        `| VERDICT: ${verdict}`
      );
    }

  }, [stream]);

  // ─── LOOP ────────────────────────────────────────────────────
  const loop = useCallback(async () => {
    if (!isLiveRef.current) return;
    await analyzeFrame();
    if (isLiveRef.current) loopRef.current = setTimeout(loop, CAPTURE_MS);
  }, [analyzeFrame]);

  const toggleLive = () => {
    if (!isLive) {
      setIsLive(true);
      isLiveRef.current = true;
      blinkTimestamps.current = [];
      scoreBuffer.current = [];
      stateRef.current = 'ANALYZING';
      frameIdxRef.current = 0;
      // Reset calibration on each new session
      baselineScreenScores = [];
      calibrationDone      = false;
      screenBaseline       = 0;
      lowScoreStreakRef.current = 0;
      loop();
    } else {
      setIsLive(false);
      isLiveRef.current = false;
      clearTimeout(loopRef.current);
    }
  };

  // ─── DERIVED UI VALUES ───────────────────────────────────────
  const v = output?.verdict;
  const scoreColor = !v || v === 'ANALYZING'
    ? '#00e0ff'
    : v === 'REAL'       ? '#00ff9f'
    : v === 'SUSPICIOUS' ? '#ffcf00'
    : '#ff4d4d';

  const labelClass = !v || v === 'ANALYZING' ? ''
    : v === 'REAL' ? 'safe' : v === 'SUSPICIOUS' ? 'warning' : 'danger';

  const verdictText = !output ? 'OFFLINE'
    : !output.buffer_ready ? 'CALIBRATING...'
    : v === 'REAL'         ? '✔ VERIFIED AUTHENTIC'
    : v === 'FAKE'         ? '❌ DEEPFAKE DETECTED'
    : v === 'SUSPICIOUS'   ? '⚠ SUSPICIOUS CONTENT'
    : '⏳ ANALYZING...';

  // Signal bar widths (0–100%)
  const sigPct = output ? {
    blink:    Math.round((output.signals.blink    / SIGNAL_MAX.blink)    * 100),
    screen:   Math.round((output.signals.screen   / SIGNAL_MAX.screen)   * 100),
    motion:   Math.round((output.signals.motion   / SIGNAL_MAX.motion)   * 100),
    texture:  Math.round((output.signals.texture  / SIGNAL_MAX.texture)  * 100),
    geometry: Math.round((output.signals.geometry / SIGNAL_MAX.geometry) * 100),
  } : null;

  return (
    <section id="livedeepfake" className="live-cam-section glass-card">
      <div className="live-cam-container">

        {/* ── HEADER ─────────────────────────────────────── */}
        <div className="hud-header">
          <h2 className="section-title">TrustGuard Sentinel V20</h2>
          <div className={`live-pulse-container ${labelClass}`}>
            <div className="pulse-dot"></div>
            <span className="live-text">
              {isLive
                ? `PIPELINE ACTIVE // FRAME: ${output?.frame_count ?? 0} // CONFIDENCE: ${output?.confidence ?? '—'}`
                : 'SYSTEM OFFLINE'}
            </span>
          </div>
        </div>

        <div className="scanner-interface">

          {/* ── VIDEO FEED ─────────────────────────────── */}
          <div className="video-container">
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {!stream ? (
              <div className="file-drop-zone">
                <i className="drop-icon fas fa-shield-alt"></i>
                <button className="scan-button" onClick={startCamera}>
                  INITIALIZE BIOMETRIC LENS
                </button>
              </div>
            ) : (
              <div className="camera-viewport">
                <video ref={videoRef} autoPlay playsInline muted className="video-feed" />
                <div className="viewport-overlay">
                  <div className="corners top-left"></div>
                  <div className="corners top-right"></div>
                  <div className="corners bottom-left"></div>
                  <div className="corners bottom-right"></div>
                  {isLive && <div className="scanning-line"></div>}
                </div>
                {/* Live score badge */}
                {output && isLive && (
                  <div className="live-score-badge" style={{ borderColor: scoreColor }}>
                    <div className="badge-score" style={{ color: scoreColor }}>
                      {output.smoothed_score}
                    </div>
                    <div className="badge-label" style={{ color: scoreColor }}>RISK</div>
                  </div>
                )}
                <div className="action-bar">
                  <button className="btn-primary" onClick={toggleLive}>
                    {isLive ? '⏹ HALT ANALYSIS' : '▶ START ANALYSIS'}
                  </button>
                  {!isLive && (
                    <button className="btn-secondary" onClick={stopAll}>CLOSE</button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── TECHNICAL HUD ──────────────────────────── */}
          <div className="technical-hud">

            {/* 1. VERDICT PANEL */}
            <div className={`hud-panel verdict-panel ${labelClass}`}>
              <div className="hud-label">HYSTERESIS_VERDICT</div>
              <div className="verdict-body">
                <div className="verdict-main" style={{ color: scoreColor }}>
                  {verdictText}
                </div>
                <div className="verdict-meta">
                  <span>SMOOTHED: {output?.smoothed_score ?? '—'}</span>
                  <span>RAW: {output?.fake_score ?? '—'}</span>
                  <span>CONF: {output?.confidence ?? '—'}</span>
                </div>
                {/* Hysteresis bar */}
                <div className="hysteresis-bar-bg">
                  <div className="hyst-zone safe"    style={{ width: `35%` }}>REAL</div>
                  <div className="hyst-zone caution" style={{ width: `10%` }}></div>
                  <div className="hyst-zone warn"    style={{ width: `17%` }}>SUS</div>
                  <div className="hyst-zone danger"  style={{ width: `38%` }}>FAKE</div>
                  {output && (
                    <div className="hyst-needle" style={{ left: `${output.smoothed_score}%` }} />
                  )}
                </div>
                <div className="hyst-tick-labels">
                  <span>0</span><span>35</span><span>45</span><span>62</span><span>100</span>
                </div>
              </div>
            </div>

            {/* 2. SIGNAL DECOMPOSITION */}
            <div className="hud-panel signal-gauges">
              <div className="hud-label">MULTI-SIGNAL DECOMPOSITION (∑ = {output?.fake_score ?? '—'}/100)</div>
              <div className="gauge-grid">
                {[
                  { key: 'screen',   label: 'SCREEN_PAD',  max: SIGNAL_MAX.screen,   w: 35 },
                  { key: 'blink',    label: 'BLINK_EAR',   max: SIGNAL_MAX.blink,    w: 20 },
                  { key: 'motion',   label: 'MOTION_COH',  max: SIGNAL_MAX.motion,   w: 20 },
                  { key: 'texture',  label: 'TEXTURE_LBP', max: SIGNAL_MAX.texture,  w: 15 },
                  { key: 'geometry', label: 'GEOM_JITTER', max: SIGNAL_MAX.geometry, w: 10 },
                ].map(g => {
                  const raw = output?.signals[g.key] ?? 0;
                  const pct = sigPct?.[g.key] ?? 0;
                  const col = pct > 60 ? '#ff4d4d' : pct > 30 ? '#ffcf00' : '#00ff9f';
                  return (
                    <div key={g.key} className="gauge-row">
                      <span className="gauge-name">{g.label}</span>
                      <span className="gauge-weight">×{g.w}%</span>
                      <div className="gauge-bar-bg">
                        <div className="gauge-bar-fill" style={{ width: `${pct}%`, background: col }} />
                      </div>
                      <span className="gauge-val" style={{ color: col }}>{raw}/{g.max}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. EXPLANATION ENGINE */}
            <div className="hud-panel explanation-matrix">
              <div className="hud-label">ARTIFACT REASONING — TOP 3 SIGNALS</div>
              <div className="signal-list">
                {output?.reasons?.map((r, i) => (
                  <div key={i} className={`signal-item ${i === 0 ? 'high' : i === 1 ? 'medium' : 'info'}`}>
                    <span className="sig-icon">{i === 0 ? '❗' : i === 1 ? '⚠' : 'ℹ'}</span>
                    <span className="sig-label">{r}</span>
                  </div>
                )) ?? (
                  <div className="signal-item info">
                    <span className="sig-icon">⏳</span>
                    <span className="sig-label">Initializing detection pipeline…</span>
                  </div>
                )}
              </div>
            </div>

            {/* 4. TEMPORAL BUFFER GRAPH */}
            <div className="hud-panel buffer-panel">
              <div className="hud-label">
                TEMPORAL BUFFER ({output?.buffer_depth ?? 0}/{BUFFER_SIZE} FRAMES
                {output?.buffer_ready ? ' — READY' : ' — CALIBRATING'})
              </div>
              <div className="buffer-waveform">
                {scoreBuffer.current.map((v, i) => (
                  <div key={i} className="wave-bar" style={{
                    height: `${Math.max(v, 2)}%`,
                    background: v > 62 ? '#ff4d4d' : v > 45 ? '#ffcf00' : '#00ff9f',
                    opacity: 0.6 + (i / scoreBuffer.current.length) * 0.4
                  }} />
                ))}
                {[...Array(Math.max(0, BUFFER_SIZE - scoreBuffer.current.length))].map((_, i) => (
                  <div key={`e${i}`} className="wave-bar empty" />
                ))}
              </div>
              <div className="buffer-meta">
                <span>INTERVAL: {CAPTURE_MS}ms</span>
                <span>VERDICT_AT: {MIN_FRAMES} FRAMES</span>
                <span>API: DISABLED (LOCAL)</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
