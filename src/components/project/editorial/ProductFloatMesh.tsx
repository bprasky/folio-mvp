'use client';

import { useRef, useMemo, Suspense, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { MotionValue } from 'framer-motion';

interface ProductFloatMeshProps {
  glbUrl: string;
  scrollProgress: MotionValue<number>;
  isHovered: boolean;
}

function ProductModel({ url }: { url: string }) {
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
    return clone;
  }, [scene]);

  return <primitive object={centeredScene} />;
}

function ScrollRotation({
  scrollProgress,
  isHovered,
  children,
}: {
  scrollProgress: MotionValue<number>;
  isHovered: boolean;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    if (isHovered) return;
    const progress = scrollProgress.get();
    groupRef.current.rotation.y = progress * (Math.PI / 2);
  });

  return <group ref={groupRef}>{children}</group>;
}

/**
 * Three.js canvas for floating 3D product in editorial.
 * Scroll-bound Y-axis rotation. On hover: pauses scroll rotation, enables OrbitControls.
 * Must be dynamically imported with ssr: false.
 */
export default function ProductFloatMesh({
  glbUrl,
  scrollProgress,
  isHovered,
}: ProductFloatMeshProps) {
  const [error, setError] = useState(false);

  if (error) return null;

  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 1, 3], fov: 40 }}
      onError={() => setError(true)}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.4} color="#fff8f0" />
      <directionalLight position={[5, 8, 3]} intensity={1.2} color="#fff5e6" />
      <directionalLight position={[-3, 4, -2]} intensity={0.4} color="#f5f0eb" />

      <Suspense fallback={null}>
        <ScrollRotation scrollProgress={scrollProgress} isHovered={isHovered}>
          <ProductModel url={glbUrl} />
        </ScrollRotation>
      </Suspense>

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={isHovered ? 0.25 : 0.12}
        scale={8}
        blur={2.5}
        far={4}
        color="#8B7355"
      />

      {isHovered && (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate={false}
        />
      )}
    </Canvas>
  );
}
