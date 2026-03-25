"use client";
import { useState } from "react";
import { AestheticProfile } from "@/lib/aesthetic/types";

type ExplanationOverlayProps = {
  aesthetic: AestheticProfile;
  onClose?: () => void;
};

export default function ExplanationOverlay({ aesthetic, onClose }: ExplanationOverlayProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-backdrop">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 hover:bg-[var(--bg-elevated)] rounded-full transition-colors"
          aria-label="Close"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="pr-8">
          <h2 className="text-3xl font-bold mb-4">Your Aesthetic Profile</h2>
          <div className="mb-6">
            <span className="inline-block px-4 py-2 bg-[var(--bg-elevated)] rounded-full text-sm font-semibold text-[var(--text-primary)] capitalize">
              {aesthetic.theme}
            </span>
            <span className="ml-3 text-sm text-[var(--text-secondary)]">
              {Math.round(aesthetic.confidence * 100)}% confidence
            </span>
          </div>

          <p className="text-lg text-[var(--text-primary)] leading-relaxed mb-6">
            {aesthetic.explanation}
          </p>

          {aesthetic.alternativeThemes.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Also considered:</p>
              <div className="flex flex-wrap gap-2">
                {aesthetic.alternativeThemes.map((theme) => (
                  <span
                    key={theme}
                    className="px-3 py-1 bg-[var(--bg-elevated)] rounded-full text-xs text-[var(--text-secondary)] capitalize"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-[var(--ridge-outer)]">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              We automatically detected your aesthetic from your uploaded projects. Your profile layout and project grid have been customized to match your style.
            </p>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-black text-white rounded-lg hover:opacity-90 transition-colors font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

