'use client';

import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import SafeImage from '@/components/common/SafeImage';

interface Product3DViewerProps {
  glbUrl: string;
  fallbackImageUrl?: string;
  productName?: string;
  onInteraction?: () => void;
  className?: string;
}

function ProductModel({ url, onLoaded }: { url: string; onLoaded?: (box: THREE.Box3) => void }) {
  const gltf = useGLTF(url, true);

  const centeredScene = useMemo(() => {
    const clone = gltf.scene.clone();

    // Deep-clone materials so textures are preserved
    clone.traverse((child: any) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
    });

    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2 / maxDim : 1;

    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    clone.scale.setScalar(scale);

    if (onLoaded) {
      const scaledBox = new THREE.Box3().setFromObject(clone);
      onLoaded(scaledBox);
    }

    return clone;
  }, [gltf.scene, onLoaded]);

  return <primitive object={centeredScene} />;
}

function SceneContent({
  url,
  onInteraction,
}: {
  url: string;
  onInteraction?: () => void;
}) {
  const [autoRotate, setAutoRotate] = useState(true);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInteracted = useRef(false);

  const handleStart = useCallback(() => {
    setAutoRotate(false);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      onInteraction?.();
    }
  }, [onInteraction]);

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
      {/* Environment map for PBR material rendering */}
      <Environment preset="studio" />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, 3]} intensity={0.8} />

      <Suspense fallback={null}>
        <ProductModel url={url} />
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
        autoRotateSpeed={3}
        enablePan={false}
        maxPolarAngle={Math.PI / 2}
        minDistance={2}
        maxDistance={8}
        onStart={handleStart}
        onEnd={handleEnd}
      />
    </>
  );
}

function LoadingShimmer({ fallbackImageUrl, productName }: { fallbackImageUrl?: string; productName?: string }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#FAF8F5]">
      {fallbackImageUrl && (
        <SafeImage
          src={fallbackImageUrl}
          alt={productName || 'Product'}
          fill
          className="object-contain opacity-30"
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      </div>
    </div>
  );
}

export default function Product3DViewer({
  glbUrl,
  fallbackImageUrl,
  productName,
  onInteraction,
  className,
}: Product3DViewerProps) {
  const [error, setError] = useState(false);

  if (error) {
    return fallbackImageUrl ? (
      <div className={`relative w-full h-[40vh] md:h-[60vh] ${className || ''}`}>
        <SafeImage
          src={fallbackImageUrl}
          alt={productName || 'Product'}
          fill
          className="object-cover"
          style={{ objectPosition: 'center 45%' }}
        />
      </div>
    ) : null;
  }

  return (
    <div
      className={`relative w-full h-[40vh] md:h-[60vh] ${className || ''}`}
      role="img"
      aria-label={`3D view of ${productName || 'product'}`}
    >
      <Suspense fallback={<LoadingShimmer fallbackImageUrl={fallbackImageUrl} productName={productName} />}>
        <Canvas
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 1.2, 3.5], fov: 40 }}
          onError={() => setError(true)}
          style={{ background: 'transparent' }}
        >
          <SceneContent url={glbUrl} onInteraction={onInteraction} />
        </Canvas>
      </Suspense>
    </div>
  );
}
