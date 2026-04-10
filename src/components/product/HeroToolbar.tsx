"use client";

import React, { useState, useEffect } from "react";

interface HeroToolbarProps {
  onRotate?: () => void;
  onZoom?: () => void;
  has3D: boolean;
  hudOpacity?: number;
}

/**
 * Row of frosted circular buttons centered at the bottom of the 3D viewport.
 * Provides quick actions: Rotate, Zoom, AR (mobile-only), Variants (future).
 */
export function HeroToolbar({ onRotate, onZoom, has3D, hudOpacity = 1 }: HeroToolbarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [rotateActive, setRotateActive] = useState(false);
  const [zoomActive, setZoomActive] = useState(false);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

  if (!has3D) return null;

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: active ? "rgba(60, 40, 20, 0.85)" : "rgba(255, 255, 255, 0.5)",
    border: active ? "none" : "0.5px solid rgba(0, 0, 0, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "11px",
    color: active ? "#fff" : "#5a4a3a",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    transition: "background 200ms ease, color 200ms ease",
  });

  return (
    <div
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2"
      style={{
        opacity: hudOpacity,
        transition: "opacity 300ms ease-out",
      }}
    >
      {/* Rotate */}
      <button
        onClick={() => {
          setRotateActive(!rotateActive);
          onRotate?.();
        }}
        style={buttonStyle(rotateActive)}
        aria-label="Auto-rotate"
        title="Rotate"
      >
        &#x21BB;
      </button>

      {/* Zoom */}
      <button
        onClick={() => {
          setZoomActive(!zoomActive);
          onZoom?.();
        }}
        style={buttonStyle(zoomActive)}
        aria-label="Toggle zoom"
        title="Zoom"
      >
        &#x2295;
      </button>

      {/* AR — mobile only */}
      {isMobile && (
        <button
          onClick={() => {
            // AR activation via model-viewer or WebXR
          }}
          style={buttonStyle(false)}
          aria-label="View in AR"
          title="AR"
        >
          AR
        </button>
      )}
    </div>
  );
}
