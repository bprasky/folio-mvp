export const springSoft = { type: "spring" as const, stiffness: 140, damping: 22, mass: 0.8 };
export const easeFast = { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] };

// Convenience clamp
export const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
