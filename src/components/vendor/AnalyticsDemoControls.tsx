"use client";

import { DemoControls } from "@/lib/vendorAnalyticsDemoState";
import { useState } from "react";

interface AnalyticsDemoControlsProps {
  controls: DemoControls;
  onChangeControls: (controls: DemoControls) => void;
}

export default function AnalyticsDemoControls({
  controls,
  onChangeControls,
}: AnalyticsDemoControlsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Only show in development or when explicitly opened
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs text-neutral-500 hover:text-neutral-700 underline"
      >
        Show Demo Controls
      </button>
    );
  }

  const handleChange = (key: keyof DemoControls, value: number) => {
    onChangeControls({
      ...controls,
      [key]: value,
    });
  };

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-neutral-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">
          Demo Controls
        </h3>
        {!isDev && (
          <button
            onClick={() => setIsOpen(false)}
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            Hide
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Event Impact Multiplier */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-neutral-700">
              Event Impact Multiplier
            </label>
            <span className="text-sm font-mono text-neutral-600">
              {controls.eventImpactMultiplier.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={controls.eventImpactMultiplier}
            onChange={(e) =>
              handleChange("eventImpactMultiplier", parseFloat(e.target.value))
            }
            className="w-full"
          />
        </div>

        {/* Product Momentum Multiplier */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-neutral-700">
              Product Momentum Multiplier
            </label>
            <span className="text-sm font-mono text-neutral-600">
              {controls.productMomentumMultiplier.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={controls.productMomentumMultiplier}
            onChange={(e) =>
              handleChange("productMomentumMultiplier", parseFloat(e.target.value))
            }
            className="w-full"
          />
        </div>

        {/* Pipeline Multiplier */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-neutral-700">
              Pipeline Multiplier
            </label>
            <span className="text-sm font-mono text-neutral-600">
              {controls.pipelineMultiplier.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={controls.pipelineMultiplier}
            onChange={(e) =>
              handleChange("pipelineMultiplier", parseFloat(e.target.value))
            }
            className="w-full"
          />
        </div>

        {/* Save to Tag Conversion Boost */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-neutral-700">
              Save→Tag Conversion Boost
            </label>
            <span className="text-sm font-mono text-neutral-600">
              +{(controls.saveToTagConversionBoost * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.05"
            value={controls.saveToTagConversionBoost}
            onChange={(e) =>
              handleChange("saveToTagConversionBoost", parseFloat(e.target.value))
            }
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}


