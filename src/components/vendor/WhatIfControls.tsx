"use client";

import { DemoControls } from "@/lib/vendorAnalyticsDemoState";

interface WhatIfControlsProps {
  controls: DemoControls;
  onChange: (controls: DemoControls) => void;
}

export const WhatIfControls: React.FC<WhatIfControlsProps> = ({
  controls,
  onChange,
}) => {
  const update = (patch: Partial<DemoControls>) =>
    onChange({ ...controls, ...patch });

  return (
    <section className="mt-6 ridge-card p-4">
      <h2 className="folio-ui font-semibold text-[var(--text-primary)]">
        What if mode
      </h2>
      <p className="mt-1 folio-meta text-[var(--text-secondary)]">
        Explore scenarios by adjusting event impact, product momentum, and
        pipeline sensitivity. These controls affect the AI's view of your data.
      </p>

      <div className="mt-4 space-y-4 folio-meta text-[var(--text-primary)]">
        <div>
          <div className="flex justify-between">
            <span>Event impact multiplier</span>
            <span>{controls.eventImpactMultiplier.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={controls.eventImpactMultiplier}
            onChange={(e) =>
              update({ eventImpactMultiplier: Number(e.target.value) })
            }
            className="mt-1 w-full"
          />
        </div>
        <div>
          <div className="flex justify-between">
            <span>Product momentum multiplier</span>
            <span>{controls.productMomentumMultiplier.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={controls.productMomentumMultiplier}
            onChange={(e) =>
              update({ productMomentumMultiplier: Number(e.target.value) })
            }
            className="mt-1 w-full"
          />
        </div>
        <div>
          <div className="flex justify-between">
            <span>Pipeline multiplier</span>
            <span>{controls.pipelineMultiplier.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={controls.pipelineMultiplier}
            onChange={(e) =>
              update({ pipelineMultiplier: Number(e.target.value) })
            }
            className="mt-1 w-full"
          />
        </div>
      </div>
    </section>
  );
};


