import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function CyberShield() {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000); // Tighter FOV for flat data look
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(240, 240);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // Subtle sterile lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x0EA5E9, 5, 10); // Edge Teal
    pointLight.position.set(2, 2, 5);
    scene.add(pointLight);

    // OBJECT: Primary Threat Globe Analytics
    const group = new THREE.Group();
    scene.add(group);

    // Core Sphere (Dark Slate)
    const coreGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const coreMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x0F172A, 
      roughness: 0.7,
      metalness: 0.3
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    // Inner Data Ring X
    const ringGeo1 = new THREE.TorusGeometry(1.8, 0.015, 16, 100);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x0EA5E9, transparent: true, opacity: 0.8 });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 2;
    group.add(ring1);

    // Inner Data Ring Y
    const ringGeo2 = new THREE.TorusGeometry(1.9, 0.015, 16, 100);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.4 });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.y = Math.PI / 2;
    group.add(ring2);

    // Outer Surveillance Wireframe Sphere
    const outerGeo = new THREE.IcosahedronGeometry(2.1, 2);
    const outerMat = new THREE.MeshBasicMaterial({ 
      color: 0xFFFFFF, 
      wireframe: true, 
      transparent: true, 
      opacity: 0.05 
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    group.add(outer);

    camera.position.z = 6;

    // ANIMATION LOOP (Strict & Precise, no wobbly bouncing)
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Precision rotations
      core.rotation.y += 0.002;
      ring1.rotation.z -= 0.005;
      ring2.rotation.z += 0.003;
      ring2.rotation.x += 0.001;
      
      outer.rotation.y -= 0.001;
      outer.rotation.x += 0.001;

      // Group slight tilt
      group.rotation.x = 0.3;
      group.rotation.z = -0.1;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      coreGeometry.dispose();
      ringGeo1.dispose();
      ringGeo2.dispose();
      outerGeo.dispose();
      coreMaterial.dispose();
      ringMat1.dispose();
      ringMat2.dispose();
      outerMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={mountRef} 
      style={{
        width: '240px',
        height: '240px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}
    >
      {/* Decorative scanning line overlay across the 3D globe container */}
      <div style={{
        position: 'absolute',
        top: 0, left: '10%', right: '10%', height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(14,165,233, 0.8), transparent)',
        animation: 'scannerSweep 3s infinite linear'
      }}></div>
      <style>{`
        @keyframes scannerSweep {
          0% { transform: translateY(0px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(240px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
