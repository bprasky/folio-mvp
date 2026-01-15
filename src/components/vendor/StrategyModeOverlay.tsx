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
      <header className="flex items-center justify-between border-b border-[var(--ridge-outer)] bg-[var(--bg-base)]/70 px-6 py-4">
        <div>
          <p className="folio-meta uppercase tracking-wide text-[var(--text-secondary)]">
            Folio AI — strategy mode
          </p>
          <h2 className="folio-ui font-semibold text-[var(--text-primary)]">
            Ask Folio anything about your business
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[var(--ridge-outer)] bg-[var(--bg-elevated)] px-3 py-1 folio-meta text-[var(--text-secondary)] hover:bg-[var(--bg-base)]"
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
              className="flex-1 rounded-full border border-[var(--ridge-outer)] bg-[var(--bg-elevated)]/80 px-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--ridge-outer)] focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-[var(--bg-base)] px-4 py-2 folio-meta font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
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


