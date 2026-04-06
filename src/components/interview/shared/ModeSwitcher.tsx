"use client";

import { Mic, Pencil } from "lucide-react";

interface ModeSwitcherProps {
  currentMode: "voice" | "text";
  onSwitch: () => void;
  disabled?: boolean;
}

/**
 * ModeSwitcher
 *
 * Persistent option to switch between voice and text modes.
 * Appears at bottom of interview screens.
 *
 * Styling:
 * - Centered at bottom of screen
 * - text-sm text-folio-text-tertiary hover:text-folio-text-secondary
 * - Icon + text: "Switch to voice" or "Switch to typing"
 * - Subtle, not prominent
 * - 24px bottom margin from screen edge
 */
export function ModeSwitcher({
  currentMode,
  onSwitch,
  disabled = false,
}: ModeSwitcherProps) {
  const targetMode = currentMode === "voice" ? "text" : "voice";
  const Icon = targetMode === "voice" ? Mic : Pencil;
  const label = targetMode === "voice" ? "Switch to voice" : "Switch to typing";

  return (
    <button
      type="button"
      onClick={onSwitch}
      disabled={disabled}
      className="flex items-center gap-2 text-sm text-folio-text-tertiary hover:text-folio-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
