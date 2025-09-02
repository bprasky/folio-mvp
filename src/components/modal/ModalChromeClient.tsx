"use client";

import React from "react";

/**
 * Centered windowed modal:
 * - Keeps page overlay blur
 * - Centers a rounded-3xl card (max-w ~1100px)
 * - Card is `relative` + `overflow-hidden` so the invitation layout's
 *   absolute full-bleed backdrop is scoped to the card (no page stretch)
 */
export default function ModalChromeClient({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const handleClose = React.useCallback(() => {
    if (onClose) onClose();
    else window.history.back();
  }, [onClose]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="mx-auto flex h-full max-h-[100svh] w-full max-w-[1120px] items-center justify-center px-4 sm:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Windowed card that *contains* the invitation layout */}
        <div className="relative w-full rounded-3xl shadow-2xl ring-1 ring-black/10 overflow-hidden bg-transparent">
          {/* Let the content control height; cap it so it scrolls if needed */}
          <div className="max-h-[90svh] overflow-y-auto">
            {children}
          </div>

          {/* Close button inside the card */}
          <button
            onClick={handleClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-[60] rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-md hover:bg-black/70"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


