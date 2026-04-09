'use client';

import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import SafeImage from '@/components/common/SafeImage';
import {
  SCENE_PRESETS,
  DEFAULT_PRESET_ID,
  getRecommendedPreset,
  type ScenePreset,
} from '@/lib/three-d/scene-presets';

interface Product3DViewerProps {
  glbUrl: string;
  fallbackImageUrl?: string;
  productName?: string;
  color?: string;
  scenePresetId?: string | null;
  productCategory?: string | null;
  onInteraction?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Background gradient — rendered as a full-screen quad behind the scene
// ---------------------------------------------------------------------------

function GradientBackground({ colors }: { colors: [string, string, string] }) {
  const { scene } = useThree();

  useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.5, colors[1]);
    gradient.addColorStop(1, colors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;

    return () => {
      tex.dispose();
    };
  }, [scene, colors]);

  return null;
}

// ---------------------------------------------------------------------------
// Ground plane with configurable material
// ---------------------------------------------------------------------------

function GroundPlane({ ground }: { ground: ScenePreset['ground'] }) {
  if (!ground.enabled) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial
        color={ground.color}
        roughness={ground.roughness}
        metalness={ground.reflectivity}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Water caustics — subtle vertex animation on the ground
// ---------------------------------------------------------------------------

function WaterGround({ ground }: { ground: ScenePreset['ground'] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const geo = mesh.geometry as THREE.PlaneGeometry;
    const pos = geo.attributes.position;
    const t = clock.getElapsedTime() * 0.3;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.5 + t) * Math.cos(y * 0.4 + t * 0.7) * 0.02);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
      <planeGeometry args={[50, 50, 64, 64]} />
      <meshStandardMaterial
        color={ground.color}
        roughness={ground.roughness}
        metalness={ground.reflectivity}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Gobo shadows — SpotLight with a window-mullion texture
// ---------------------------------------------------------------------------

function GoboLight() {
  const lightRef = useRef<THREE.SpotLight>(null);

  const goboMap = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // White base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);

    // Window mullion bars (dark stripes block light)
    ctx.fillStyle = '#000000';
    // Vertical bars
    ctx.fillRect(82, 0, 6, 256);
    ctx.fillRect(168, 0, 6, 256);
    // Horizontal bar
    ctx.fillRect(0, 126, 256, 6);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  return (
    <spotLight
      ref={lightRef}
      position={[-8, 12, 4]}
      angle={0.4}
      penumbra={0.6}
      intensity={0.8}
      color="#fff5e0"
      castShadow
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
      map={goboMap}
    />
  );
}

// ---------------------------------------------------------------------------
// Scene fog
// ---------------------------------------------------------------------------

function SceneFog({ fog }: { fog: NonNullable<ScenePreset['fog']> }) {
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
    return () => {
      scene.fog = null;
    };
  }, [scene, fog.color, fog.near, fog.far]);

  return null;
}

// ---------------------------------------------------------------------------
// Product model with tight camera framing
// ---------------------------------------------------------------------------

function ProductModel({
  url,
  color,
  onLoaded,
}: {
  url: string;
  color?: string;
  onLoaded?: (box: THREE.Box3) => void;
}) {
  const gltf = useGLTF(url, true);

  const centeredScene = useMemo(() => {
    const clone = gltf.scene.clone();

    clone.traverse((child: any) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        if (color && !child.material.map) {
          child.material.color = new THREE.Color(color);
        }
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2 / maxDim : 1;

    // Position so bottom of mesh sits on y=0 (the ground plane)
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

// ---------------------------------------------------------------------------
// Camera framing — three-quarter product photography angle
// ---------------------------------------------------------------------------

function CameraFramer({ box }: { box: THREE.Box3 | null }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const framed = useRef(false);

  useEffect(() => {
    if (!box || framed.current) return;
    framed.current = true;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);

    // Product fills ~75% of frame
    const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.2;

    // Three-quarter product photography angle
    camera.position.set(
      center.x + distance * 0.45,
      center.y + distance * 0.22,
      center.z + distance * 0.82,
    );
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }, [box, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      maxPolarAngle={Math.PI / 2}
      minDistance={1.5}
      maxDistance={8}
      target={box ? box.getCenter(new THREE.Vector3()) : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Scene content — assembled from preset
// ---------------------------------------------------------------------------

function SceneContent({
  url,
  color,
  preset,
  onInteraction,
}: {
  url: string;
  color?: string;
  preset: ScenePreset;
  onInteraction?: () => void;
}) {
  const [modelBox, setModelBox] = useState<THREE.Box3 | null>(null);
  const hasInteracted = useRef(false);

  const handleLoaded = useCallback((box: THREE.Box3) => {
    setModelBox(box);
  }, []);

  // Track user interaction
  useEffect(() => {
    const handler = () => {
      if (!hasInteracted.current) {
        hasInteracted.current = true;
        onInteraction?.();
      }
    };
    // Listen on the canvas for pointer events
    const canvas = document.querySelector('canvas');
    canvas?.addEventListener('pointerdown', handler, { once: true });
    return () => canvas?.removeEventListener('pointerdown', handler);
  }, [onInteraction]);

  return (
    <>
      {/* Background gradient */}
      <GradientBackground colors={preset.bgGradient} />

      {/* Fog */}
      {preset.fog && <SceneFog fog={preset.fog} />}

      {/* Lighting — key, fill, rim, ambient */}
      <directionalLight
        position={preset.lights.key.position}
        intensity={preset.lights.key.intensity}
        color={preset.lights.key.color}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      <directionalLight
        position={preset.lights.fill.position}
        intensity={preset.lights.fill.intensity}
        color={preset.lights.fill.color}
      />
      <directionalLight
        position={preset.lights.rim.position}
        intensity={preset.lights.rim.intensity}
        color={preset.lights.rim.color}
      />
      <ambientLight
        color={preset.lights.ambient.color}
        intensity={preset.lights.ambient.intensity}
      />

      {/* Effects */}
      {preset.effects.goboShadows && <GoboLight />}

      {/* Ground plane */}
      {preset.effects.waterCaustics ? (
        <WaterGround ground={preset.ground} />
      ) : (
        <GroundPlane ground={preset.ground} />
      )}

      {/* Contact shadow (on top of ground) */}
      {preset.shadow.opacity > 0 && (
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={preset.shadow.opacity}
          scale={10}
          blur={2.5}
          far={4}
          color={preset.shadow.color}
        />
      )}

      {/* Product mesh */}
      <Suspense fallback={null}>
        <ProductModel url={url} color={color} onLoaded={handleLoaded} />
      </Suspense>

      {/* Camera + controls */}
      <CameraFramer box={modelBox} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Loading shimmer
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function Product3DViewer({
  glbUrl,
  fallbackImageUrl,
  productName,
  color,
  scenePresetId,
  productCategory,
  onInteraction,
  className,
}: Product3DViewerProps) {
  const [error, setError] = useState(false);

  // Resolve preset
  const presetId = scenePresetId || getRecommendedPreset(productCategory) || DEFAULT_PRESET_ID;
  const preset = SCENE_PRESETS[presetId] || SCENE_PRESETS[DEFAULT_PRESET_ID];

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
          gl={{
            alpha: false,
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
          }}
          shadows={{ type: THREE.PCFSoftShadowMap }}
          camera={{ fov: 35, near: 0.1, far: 100 }}
          dpr={[1, 2]}
          onError={() => setError(true)}
        >
          <SceneContent
            url={glbUrl}
            color={color}
            preset={preset}
            onInteraction={onInteraction}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}
