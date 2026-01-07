'use client';

// Import JSON files - Next.js supports JSON imports by default
import eventsSeed from '@/data/demo/vendor/events.json';
import projectsSeed from '@/data/demo/vendor/projects.json';
import designersSeed from '@/data/demo/vendor/designers.json';

// Diagnostic: verify imports work
if (typeof window !== 'undefined') {
  console.log('[DEMO] Events seed loaded:', !!eventsSeed);
  console.log('[DEMO] Projects seed loaded:', !!projectsSeed);
  console.log('[DEMO] Designers seed loaded:', !!designersSeed);
}

/**
 * Demo Store - Manages demo data state with localStorage persistence
 * Allows live editing of demo values for investor pitches
 */

export type DemoState = {
  events: typeof eventsSeed;
  projects: typeof projectsSeed;
  designers: typeof designersSeed;
};

const KEY = 'folio.vendor.demo.v1';

/**
 * Load demo state from localStorage
 */
function fromStorage(): DemoState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save demo state to localStorage
 */
function toStorage(state: DemoState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[demoStore] Failed to save to localStorage:', error);
  }
}

/**
 * Get initial demo state (from localStorage or seed data)
 */
export function getInitialDemoState(): DemoState {
  const persisted = fromStorage();
  return persisted ?? {
    events: eventsSeed,
    projects: projectsSeed,
    designers: designersSeed,
  };
}

/**
 * Save demo state
 */
export function saveDemoState(state: DemoState) {
  toStorage(state);
}

/**
 * Reset demo state to seed data
 */
export function resetDemoState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch (error) {
    console.warn('[demoStore] Failed to reset localStorage:', error);
  }
}

