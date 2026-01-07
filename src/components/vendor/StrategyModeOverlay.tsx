"use client";

import { useState } from "react";
import { DynamicInsightPanel } from "./DynamicInsightPanel";
import { DemoControls } from "@/lib/vendorAnalyticsDemoState";

interface StrategyModeOverlayProps {
  open: boolean;
  onClose: () => void;
  vendorId: string;
  scenarioControls: DemoControls;
}

export const StrategyModeOverlay: React.FC<StrategyModeOverlayProps> = ({
  open,
  onClose,
  vendorId,
  scenarioControls,
}) => {
  const [question, setQuestion] = useState<string | null>(null);
  const [input, setInput] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950/70 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Folio AI — strategy mode
          </p>
          <h2 className="text-sm font-semibold text-neutral-50">
            Ask Folio anything about your business
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
        >
          Close
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              setQuestion(input.trim());
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="For example: 'Walk me through my Q4 strategy' or 'Where should I focus next quarter?'"
              className="flex-1 rounded-full border border-neutral-700 bg-neutral-900/80 px-4 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-900 hover:bg-white"
            >
              Ask
            </button>
          </form>

          <DynamicInsightPanel
            initialQuestion={question}
            vendorId={vendorId}
            scenarioControls={scenarioControls}
            mode="strategy"
          />
        </div>
      </main>
    </div>
  );
};


