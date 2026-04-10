import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function ParticleBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // SCENE, CAMERA, RENDERER
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // PARTICLES / NODES
    const particleCount = window.innerWidth < 768 ? 100 : 250;
    const maxDistance = window.innerWidth < 768 ? 2 : 2.5;
    const spread = 20;

    const group = new THREE.Group();
    scene.add(group);

    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        // Random placement within a volume
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Stark black points for Brutalist feel
    const pointMaterial = new THREE.PointsMaterial({
      color: 0x0EA5E9, // Enterprise Teal
      size: 0.08, // Smaller, sharper points
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(geometry, pointMaterial);
    group.add(particles);

    // CONNECTIONS (LINES)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xFFFFFF, 
      transparent: true,
      opacity: 0.04, // Extremely subtle lines
    });
    
    // Connect nodes that are close to each other
    const indices = [];
    for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
            const dx = positions[i * 3] - positions[j * 3];
            const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
            const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < maxDistance * maxDistance) {
                indices.push(i, j);
            }
        }
    }
    geometry.setIndex(indices);
    const lines = new THREE.LineSegments(geometry, lineMaterial);
    group.add(lines);

    camera.position.z = 10;

    // PARALLAX MOUSE
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let windowHalfX = window.innerWidth / 2;
    let windowHalfY = window.innerHeight / 2;

    const onPointerMove = (event) => {
      mouseX = (event.clientX - windowHalfX) * 0.001; // subtle
      mouseY = (event.clientY - windowHalfY) * 0.001;
    };
    document.addEventListener('pointermove', onPointerMove);

    // ANIMATION LOOP
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      targetX = mouseX;
      targetY = mouseY;
      
      // Smooth interpolation towards mouse
      group.rotation.x += 0.02 * (targetY - group.rotation.x);
      group.rotation.y += 0.02 * (targetX - group.rotation.y);
      
      // Auto constant slow rotation
      group.rotation.y += 0.0008;
      group.rotation.x += 0.0004;
      group.rotation.z += 0.0002;

      renderer.render(scene, camera);
    };
    animate();

    // RESIZE WINDOW
    const onWindowResize = () => {
      windowHalfX = window.innerWidth / 2;
      windowHalfY = window.innerHeight / 2;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onWindowResize);

    // CLEANUP
    return () => {
      window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('pointermove', onPointerMove);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      pointMaterial.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={mountRef} 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none'
      }}
    />
  );
}
