'use client';

import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, useGLTF, Environment, MeshReflectorMaterial } from '@react-three/drei';
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
  onOrbitStart?: () => void;
  onOrbitEnd?: () => void;
  onDoubleClick?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Ground plane with configurable material
// ---------------------------------------------------------------------------

function GroundPlane({ ground }: { ground: ScenePreset['ground'] }) {
  if (!ground.enabled) return null;

  if (ground.mirror) {
    // Real reflections — infinite mirror surface (salt flats, water)
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <planeGeometry args={[100, 100]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={1024}
          mixBlur={0.8}
          mixStrength={0.6}
          roughness={ground.roughness}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color={ground.color}
          metalness={ground.reflectivity}
          mirror={0.5}
        />
      </mesh>
    );
  }

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

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#000000';
    ctx.fillRect(82, 0, 6, 256);
    ctx.fillRect(168, 0, 6, 256);
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

function CameraFramer({
  box,
  onInteraction,
  onOrbitStart,
  onOrbitEnd,
}: {
  box: THREE.Box3 | null;
  onInteraction?: () => void;
  onOrbitStart?: () => void;
  onOrbitEnd?: () => void;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const framed = useRef(false);
  const hasInteracted = useRef(false);

  useEffect(() => {
    if (!box || framed.current) return;
    framed.current = true;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);

    const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.2;

    camera.position.set(
      center.x + distance * 0.45,
      center.y + distance * 0.22,
      center.z + distance * 0.82,
    );
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }, [box, camera]);

  const target = box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 1, 0);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={target}
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
        onOrbitStart?.();
      }}
      onEnd={() => {
        onOrbitEnd?.();
      }}
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
  onOrbitStart,
  onOrbitEnd,
  onModelReady,
}: {
  url: string;
  color?: string;
  preset: ScenePreset;
  onInteraction?: () => void;
  onOrbitStart?: () => void;
  onOrbitEnd?: () => void;
  onModelReady?: () => void;
}) {
  const [modelBox, setModelBox] = useState<THREE.Box3 | null>(null);

  const handleLoaded = useCallback((box: THREE.Box3) => {
    setModelBox(box);
    onModelReady?.();
  }, [onModelReady]);

  return (
    <>
      {/* HDRI environment — provides realistic lighting + background */}
      <Environment
        files={preset.environment.hdriPath}
        background={true}
        backgroundBlurriness={preset.environment.backgroundBlurriness}
        backgroundIntensity={preset.environment.backgroundIntensity}
        environmentIntensity={preset.environment.environmentIntensity}
      />

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
      <CameraFramer box={modelBox} onInteraction={onInteraction} onOrbitStart={onOrbitStart} onOrbitEnd={onOrbitEnd} />
    </>
  );
}

export default function Product3DViewer({
  glbUrl,
  fallbackImageUrl,
  productName,
  color,
  scenePresetId,
  productCategory,
  onInteraction,
  onOrbitStart,
  onOrbitEnd,
  onDoubleClick,
  className,
}: Product3DViewerProps) {
  const [error, setError] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  const handleModelReady = useCallback(() => {
    setModelReady(true);
  }, []);

  // Resolve preset
  const presetId = scenePresetId || getRecommendedPreset(productCategory) || DEFAULT_PRESET_ID;
  const preset = SCENE_PRESETS[presetId] || SCENE_PRESETS[DEFAULT_PRESET_ID];

  // If caller provides a className with height (e.g. h-full), use it; otherwise default
  const hasCustomHeight = className && /\bh-/.test(className);
  const heightClass = hasCustomHeight ? '' : 'h-[40vh] md:h-[60vh]';

  if (error) {
    return fallbackImageUrl ? (
      <div className={`relative w-full ${heightClass} ${className || ''}`}>
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
      className={`relative w-full ${heightClass} ${className || ''}`}
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
        onDoubleClick={onDoubleClick}
      >
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
            onOrbitStart={onOrbitStart}
            onOrbitEnd={onOrbitEnd}
            onModelReady={handleModelReady}
          />
        </Canvas>
      </div>
    </div>
  );
}
