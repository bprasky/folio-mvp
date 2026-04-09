'use client';

import { Suspense, useState, useRef, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, ContactShadows, Environment } from '@react-three/drei';
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
  onModelReady,
}: {
  url: string;
  color?: string;
  onInteraction?: () => void;
  onModelReady?: () => void;
}) {
  const hasInteracted = useRef(false);

  const handleModelLoaded = useCallback(
    (_box: THREE.Box3) => {
      onModelReady?.();
    },
    [onModelReady]
  );

  return (
    <>
      {/* Key light — warm, upper left */}
      <directionalLight position={[-5, 5, 5]} intensity={1.2} color="#fff5e6" castShadow />
      {/* Fill light — cooler, right side */}
      <directionalLight position={[5, 3, 2]} intensity={0.4} color="#f0f0ff" />
      {/* Rim light — behind and above */}
      <directionalLight position={[0, 4, -5]} intensity={0.6} color="#fff8f0" />
      {/* Soft ambient base */}
      <ambientLight intensity={0.3} color="#faf5ef" />

      <Environment files="/assets/hdri/studio_small_03_1k.hdr" background={false} environmentIntensity={0.5} />

      <Suspense fallback={null}>
        <ProductModel url={url} color={color} onLoaded={handleModelLoaded} />
      </Suspense>

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.12}
        scale={10}
        blur={2.5}
        far={4}
        color="#8B7355"
      />

      <OrbitControls
        makeDefault
        target={[0, 1, 0]}
        enablePan={false}
        enableZoom={false}
        enableRotate={true}
        rotateSpeed={0.5}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        onStart={() => {
          if (!hasInteracted.current) {
            hasInteracted.current = true;
            onInteraction?.();
          }
        }}
      />
    </>
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
  const [modelReady, setModelReady] = useState(false);

  const handleModelReady = useCallback(() => {
    setModelReady(true);
  }, []);

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
      {/* Fallback image — crossfades out when 3D model is ready */}
      {fallbackImageUrl && (
        <div
          className="absolute inset-0 z-10"
          style={{
            opacity: modelReady ? 0 : 1,
            transition: 'opacity 500ms ease-out',
            pointerEvents: modelReady ? 'none' : 'auto',
          }}
        >
          <SafeImage
            src={fallbackImageUrl}
            alt={productName || 'Product'}
            fill
            className="object-contain"
            style={{ background: '#FAF8F5' }}
          />
        </div>
      )}

      {/* 3D Canvas — crossfades in when model is ready */}
      <div
        className="absolute inset-0"
        style={{
          opacity: modelReady ? 1 : 0,
          transition: 'opacity 500ms ease-out',
        }}
      >
        <Canvas
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [3, 2, 5], fov: 40 }}
          onError={() => setError(true)}
          style={{ background: 'transparent' }}
        >
          <SceneContent
            url={glbUrl}
            color={color}
            onInteraction={onInteraction}
            onModelReady={handleModelReady}
          />
        </Canvas>
      </div>
    </div>
  );
}
