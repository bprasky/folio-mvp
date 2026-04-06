'use client';

import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF } from '@react-three/drei';
import { FaTimes, FaSpinner } from 'react-icons/fa';

/**
 * ThreeDPreview Component
 * 
 * Lightweight 3D viewer for GLB models using react-three-fiber
 * 
 * @param glbUrl - URL to the GLB model file
 * @param onClose - Callback when user closes the preview
 */
export type ThreeDPreviewProps = {
  glbUrl: string;
  onClose: () => void;
};

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url, true); // true = use draco loader if available
  return <primitive object={scene} scale={1} />;
}

function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--text-primary)]/50">
      <div className="flex flex-col items-center gap-3">
        <FaSpinner className="w-8 h-8 text-white animate-spin" />
        <p className="text-white text-sm">Loading 3D model...</p>
      </div>
    </div>
  );
}

export default function ThreeDPreview({ glbUrl, onClose }: ThreeDPreviewProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full h-full max-w-4xl max-h-[90vh] bg-[var(--text-primary)] rounded-lg overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/70 text-white rounded-full hover:bg-black/90 transition-colors"
          aria-label="Close preview"
        >
          <FaTimes className="w-5 h-5" />
        </button>

        {/* 3D Canvas */}
        <div className="w-full h-full">
          {error ? (
            <div className="flex items-center justify-center h-full text-white">
              <div className="text-center">
                <p className="text-lg mb-2">Failed to load 3D model</p>
                <p className="text-sm text-folio-text-tertiary">{error}</p>
              </div>
            </div>
          ) : (
            <Canvas
              camera={{ position: [0, 0, 5], fov: 50 }}
              onError={(e) => {
                console.error('Canvas error:', e);
                setError('Failed to render 3D model');
              }}
            >
              <Suspense fallback={null}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <pointLight position={[-10, -10, -5]} intensity={0.5} />
                <Environment preset="sunset" />
                <Model url={glbUrl} />
                <OrbitControls
                  enablePan={true}
                  enableZoom={true}
                  enableRotate={true}
                  minDistance={2}
                  maxDistance={10}
                />
              </Suspense>
            </Canvas>
          )}
        </div>

        {/* Loading overlay */}
        {!error && (
          <Suspense fallback={<LoadingSpinner />}>
            <div className="absolute inset-0 pointer-events-none">
              {/* This will be replaced by Suspense fallback */}
            </div>
          </Suspense>
        )}

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 right-4 text-center text-white/70 text-xs pointer-events-none">
          <p>Drag to rotate • Scroll to zoom • Right-click to pan</p>
        </div>
      </div>
    </div>
  );
}

// Preload GLB models (optional optimization)
export function preloadGLB(url: string) {
  useGLTF.preload(url);
}

