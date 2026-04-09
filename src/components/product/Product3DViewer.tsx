'use client';

import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import SafeImage from '@/components/common/SafeImage';

interface Product3DViewerProps {
  glbUrl: string;
  fallbackImageUrl?: string;
  productName?: string;
  color?: string; // hex color to tint the mesh, e.g. '#8B7355'
  onInteraction?: () => void;
  className?: string;
}

function ProductModel({ url, color, onLoaded }: { url: string; color?: string; onLoaded?: (box: THREE.Box3) => void }) {
  const gltf = useGLTF(url, true);

  const centeredScene = useMemo(() => {
    const clone = gltf.scene.clone();

    // Deep-clone materials; apply tint color only if mesh has no textures
    clone.traverse((child: any) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        // Only tint if the material has no base color texture (untextured mesh)
        if (color && !child.material.map) {
          child.material.color = new THREE.Color(color);
        }
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
  }, [gltf.scene, color, onLoaded]);

  return <primitive object={centeredScene} />;
}

function SceneContent({
  url,
  color,
  onInteraction,
}: {
  url: string;
  color?: string;
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
      {/* Hemisphere light provides IBL-like ambient for PBR materials */}
      <hemisphereLight args={['#ffffff', '#e8ddd0', 2.0]} />
      <directionalLight position={[5, 8, 3]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-4, 6, -3]} intensity={0.8} color="#f5f0eb" />
      <directionalLight position={[0, -2, 5]} intensity={0.3} color="#ffffff" />

      <Suspense fallback={null}>
        <ProductModel url={url} color={color} />
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
  color,
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
          <SceneContent url={glbUrl} color={color} onInteraction={onInteraction} />
        </Canvas>
      </Suspense>
    </div>
  );
}
