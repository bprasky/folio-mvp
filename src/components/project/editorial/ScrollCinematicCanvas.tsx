'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useTexture, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { MotionValue } from 'framer-motion';
import type { EditorialTag } from '@/types/editorial';

interface ScrollCinematicCanvasProps {
  imageUrl: string;
  meshTags: EditorialTag[];
  variant: 'parallaxDrift' | 'roomSweep';
  scrollProgress: MotionValue<number>;
}

/**
 * Positions a loaded GLB model based on tag coordinates and depth estimate.
 * x,y from the tag (0-1 range mapped to scene coordinates), z from depth.
 */
function PositionedMesh({
  tag,
  sceneWidth,
  sceneHeight,
}: {
  tag: EditorialTag;
  sceneWidth: number;
  sceneHeight: number;
}) {
  const url = tag.mesh3dUrl!;
  const { scene } = useGLTF(url, true);

  const centeredScene = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    // Scale products to reasonable size relative to scene
    const scale = maxDim > 0 ? 1.5 / maxDim : 1;

    clone.position.set(-center.x, -box.min.y, -center.z);
    clone.scale.setScalar(scale);
    return clone;
  }, [scene]);

  // Map tag coordinates to 3D positions
  const tagX = tag.x ?? 0.5;
  const tagY = tag.y ?? 0.5;
  const depth = tag.meshDepthEstimate ?? 0.5;

  // x: -sceneWidth/2 to sceneWidth/2
  // y: sceneHeight/2 to -sceneHeight/2 (inverted for 3D)
  // z: depth 0 (foreground, z=2) to depth 1 (background, z=-5)
  const x = (tagX - 0.5) * sceneWidth;
  const y = (0.5 - tagY) * sceneHeight * 0.5;
  const z = 2 - depth * 7; // foreground at z=2, background at z=-5

  return (
    <group position={[x, y, z]}>
      <primitive object={centeredScene} />
    </group>
  );
}

/**
 * Backdrop plane with the room photo as texture.
 */
function BackdropPlane({ imageUrl, width, height }: { imageUrl: string; width: number; height: number }) {
  const texture = useTexture(imageUrl);

  return (
    <mesh position={[0, 0, -8]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/**
 * Camera rig that responds to scroll progress.
 * Parallax Drift: subtle z-axis dolly
 * Room Sweep: horizontal pan + dolly
 */
function CameraRig({
  variant,
  scrollProgress,
}: {
  variant: 'parallaxDrift' | 'roomSweep';
  scrollProgress: MotionValue<number>;
}) {
  const { camera } = useThree();
  const scrollRef = useRef(0);

  useFrame(() => {
    const progress = scrollProgress.get();
    // Smooth interpolation
    scrollRef.current += (progress - scrollRef.current) * 0.1;
    const t = scrollRef.current;

    if (variant === 'parallaxDrift') {
      // Subtle z-axis dolly: camera moves from z=6 to z=5 (5-10% depth)
      camera.position.z = 6 - t * 1.0;
      // Tiny vertical drift
      camera.position.y = 0.8 + t * 0.2;
    } else {
      // Room sweep: horizontal pan + slight dolly
      camera.position.x = (t - 0.5) * 2.0; // pan left to right
      camera.position.z = 6 - t * 0.8;
      camera.position.y = 0.8 + t * 0.1;
    }

    camera.lookAt(0, 0, -2);
  });

  return null;
}

/**
 * Three.js Canvas for scroll-driven cinematic rendering.
 * Must be dynamically imported with ssr: false.
 */
export default function ScrollCinematicCanvas({
  imageUrl,
  meshTags,
  variant,
  scrollProgress,
}: ScrollCinematicCanvasProps) {
  const sceneWidth = 12;
  const sceneHeight = 8;

  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.8, 6], fov: 45 }}
      style={{ background: 'transparent' }}
    >
      {/* Warm studio lighting */}
      <ambientLight intensity={0.4} color="#fff8f0" />
      <directionalLight position={[5, 8, 3]} intensity={1.0} color="#fff5e6" />
      <directionalLight position={[-3, 4, -2]} intensity={0.3} color="#f5f0eb" />

      {/* Room photo backdrop */}
      <Suspense fallback={null}>
        <BackdropPlane
          imageUrl={imageUrl}
          width={sceneWidth * 1.5}
          height={sceneHeight * 1.5}
        />
      </Suspense>

      {/* Product meshes positioned by tag data */}
      <Suspense fallback={null}>
        {meshTags.map((tag) => (
          <PositionedMesh
            key={tag.id}
            tag={tag}
            sceneWidth={sceneWidth}
            sceneHeight={sceneHeight}
          />
        ))}
      </Suspense>

      {/* Ground contact shadows */}
      <ContactShadows
        position={[0, -2, 0]}
        opacity={0.1}
        scale={20}
        blur={3}
        far={8}
        color="#8B7355"
      />

      {/* Scroll-driven camera rig */}
      <CameraRig variant={variant} scrollProgress={scrollProgress} />
    </Canvas>
  );
}
