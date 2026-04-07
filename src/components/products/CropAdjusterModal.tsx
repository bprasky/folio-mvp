"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";

interface CropAdjusterModalProps {
  tagId: string;
  sourceImageUrl: string;
  currentCropX: number;   // 0-100
  currentCropY: number;   // 0-100
  currentCropScale?: number; // 0-1
  category?: string;
  productName: string;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_SCALE = 0.45;
const MIN_SCALE = 0.15;
const MAX_SCALE = 0.85;

export function CropAdjusterModal({
  tagId,
  sourceImageUrl,
  currentCropX,
  currentCropY,
  currentCropScale,
  productName,
  onClose,
  onSaved,
}: CropAdjusterModalProps) {
  const [cropX, setCropX] = useState(currentCropX);
  const [cropY, setCropY] = useState(currentCropY);
  const [cropScale, setCropScale] = useState(currentCropScale ?? DEFAULT_SCALE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Crop region size as % of the image
  const regionSize = cropScale * 100;

  // Clamp crop center so the region stays within bounds
  const clamp = useCallback((val: number, half: number) => {
    return Math.max(half, Math.min(100 - half, val));
  }, []);

  const clampedX = clamp(cropX, regionSize / 2);
  const clampedY = clamp(cropY, regionSize / 2);

  // Convert pointer position to crop center (0-100)
  const pointerToCrop = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      setCropX(Math.max(0, Math.min(100, x)));
      setCropY(Math.max(0, Math.min(100, y)));
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      pointerToCrop(e.clientX, e.clientY);
    },
    [pointerToCrop]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      pointerToCrop(e.clientX, e.clientY);
    },
    [pointerToCrop]
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Mouse wheel to adjust scale
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCropScale((prev) => {
      const delta = e.deltaY > 0 ? 0.03 : -0.03;
      return Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta));
    });
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/tags/${tagId}/crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cropX: clampedX,
          cropY: clampedY,
          cropScale,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save crop");
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save");
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCropX(currentCropX);
    setCropY(currentCropY);
    setCropScale(currentCropScale ?? DEFAULT_SCALE);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="relative z-10 w-full max-w-lg bg-surface-canvas rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-folio-border-subtle">
          <h3 className="font-['Instrument_Sans'] text-[15px] font-medium text-folio-text-primary">
            Adjust crop
          </h3>
          <p className="font-['Instrument_Sans'] text-[12px] text-folio-text-tertiary mt-0.5">
            {productName}
          </p>
        </div>

        {/* Image + Crop Region */}
        <div className="px-5 py-4 space-y-4">
          <p className="font-['Instrument_Sans'] text-[11px] text-folio-text-tertiary">
            Click or drag to move center. Scroll to zoom. Slider below for fine control.
          </p>

          <div
            ref={containerRef}
            className="relative w-full aspect-[4/3] rounded-xl overflow-hidden cursor-crosshair select-none bg-surface-elevated"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* Source image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sourceImageUrl}
              alt="Source"
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />

            {/* Dim overlay — areas outside crop */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Full dim layer */}
              <div className="absolute inset-0 bg-black/50" />
              {/* Clear crop region */}
              <div
                className="absolute border-2 border-white shadow-lg"
                style={{
                  left: `${clampedX - regionSize / 2}%`,
                  top: `${clampedY - regionSize / 2}%`,
                  width: `${regionSize}%`,
                  height: `${regionSize}%`,
                  background: "transparent",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.50)",
                }}
              />
            </div>

            {/* Crosshair at center */}
            <div
              className="absolute w-3 h-3 pointer-events-none"
              style={{
                left: `${clampedX}%`,
                top: `${clampedY}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="absolute inset-0 rounded-full border-2 border-white shadow-md" />
            </div>
          </div>

          {/* Scale slider */}
          <div className="flex items-center gap-3">
            <span className="font-['Instrument_Sans'] text-[11px] text-folio-text-tertiary w-8">Tight</span>
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.01}
              value={cropScale}
              onChange={(e) => setCropScale(parseFloat(e.target.value))}
              className="flex-1 h-1.5 accent-stone-700 cursor-pointer"
            />
            <span className="font-['Instrument_Sans'] text-[11px] text-folio-text-tertiary w-8">Wide</span>
          </div>

          {/* Preview */}
          <div className="flex items-start gap-4">
            <div>
              <p className="font-['Instrument_Sans'] text-[10px] text-folio-text-tertiary uppercase tracking-wider mb-1.5">
                Preview
              </p>
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-surface-elevated ring-1 ring-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sourceImageUrl}
                  alt="Crop preview"
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition: `${clampedX}% ${clampedY}%`,
                    transform: `scale(${1 / cropScale})`,
                    transformOrigin: `${clampedX}% ${clampedY}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex-1 pt-5">
              <p className="font-['Instrument_Sans'] text-[11px] text-folio-text-tertiary">
                Position: {Math.round(clampedX)}%, {Math.round(clampedY)}%
              </p>
              <p className="font-['Instrument_Sans'] text-[11px] text-folio-text-tertiary">
                Zoom: {Math.round(cropScale * 100)}%
              </p>
            </div>
          </div>

          {error && (
            <p className="font-['Instrument_Sans'] text-[12px] text-red-500">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-folio-border-subtle flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="font-['Instrument_Sans'] text-[12px] text-folio-text-tertiary hover:text-folio-text-secondary transition-colors duration-150"
          >
            Reset to default
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-['Instrument_Sans'] text-[13px] text-folio-text-secondary hover:bg-surface-elevated transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-stone-800 text-white font-['Instrument_Sans'] text-[13px] hover:bg-stone-700 disabled:opacity-50 transition-colors duration-150"
            >
              {saving ? "Saving..." : "Save crop"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
