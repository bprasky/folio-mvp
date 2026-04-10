'use client';

import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface MeshLayerProps {
  glbUrl: string;
  isVisible: boolean;
  onLoaded?: () => void;
  autoRotateSpeed?: number; // default 3
}

function ProductModel({ url, onLoaded }: { url: string; onLoaded?: () => void }) {
  const { scene } = useGLTF(url, true);

  const centeredScene = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2 / maxDim : 1;

    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    clone.scale.setScalar(scale);

    onLoaded?.();
    return clone;
  }, [scene, onLoaded]);

  return <primitive object={centeredScene} />;
}

function SceneContent({ url, onLoaded, rotateSpeed = 3 }: { url: string; onLoaded?: () => void; rotateSpeed?: number }) {
  const [autoRotate, setAutoRotate] = useState(true);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStart = useCallback(() => {
    setAutoRotate(false);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  const handleEnd = useCallback(() => {
    resumeTimer.current = setTimeout(() => setAutoRotate(true), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  return (
    <>
      <ambientLight intensity={0.4} color="#fff8f0" />
      <directionalLight position={[5, 8, 3]} intensity={1.2} color="#fff5e6" />
      <directionalLight position={[-3, 4, -2]} intensity={0.4} color="#f5f0eb" />
      <pointLight position={[-5, 5, -5]} intensity={0.6} color="#ffe8d0" />

      <Suspense fallback={null}>
        <ProductModel url={url} onLoaded={onLoaded} />
      </Suspense>

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.15}
        scale={10}
        blur={2.5}
        far={4}
        color="#8B7355"
      />

      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={rotateSpeed}
        enablePan={false}
        enableZoom={false}
        maxPolarAngle={Math.PI / 2}
        minDistance={2}
        maxDistance={6}
        onStart={handleStart}
        onEnd={handleEnd}
      />
    </>
  );
}

/**
 * Three.js canvas for rendering a product mesh in the tag lift-off interaction.
 * Reuses the same lighting and model normalization as Product3DViewer.
 *
 * Must be dynamically imported with ssr: false.
 */
export default function MeshLayer({ glbUrl, isVisible, onLoaded, autoRotateSpeed = 3 }: MeshLayerProps) {
  const [error, setError] = useState(false);

  if (error || !isVisible) return null;

  return (
    <div className="absolute inset-0 z-[10]">
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 1.2, 3.5], fov: 40 }}
        onError={() => setError(true)}
        style={{ background: 'transparent' }}
      >
        <SceneContent url={glbUrl} onLoaded={onLoaded} rotateSpeed={autoRotateSpeed} />
      </Canvas>
    </div>
  );
}
