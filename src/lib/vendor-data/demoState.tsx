'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import eventsSeed from '@/data/demo/vendor/events.json';
import projectsSeed from '@/data/demo/vendor/projects.json';
import designersSeed from '@/data/demo/vendor/designers.json';

const STORAGE_KEY = 'folio.vendor.demo.v2';

export type DemoState = {
  events: typeof eventsSeed;
  projects: typeof projectsSeed;
  designers: typeof designersSeed;
};

type DemoContextValue = {
  state: DemoState;
  setState: (updater: (prev: DemoState) => DemoState) => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

function loadInitial(): DemoState {
  if (typeof window === 'undefined') {
    return { events: eventsSeed, projects: projectsSeed, designers: designersSeed };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { events: eventsSeed, projects: projectsSeed, designers: designersSeed };
    return JSON.parse(raw) as DemoState;
  } catch {
    return { events: eventsSeed, projects: projectsSeed, designers: designersSeed };
  }
}

function persist(state: DemoState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore localStorage errors
  }
}

export function DemoStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateRaw] = useState<DemoState>(loadInitial);

  const setState = (updater: (prev: DemoState) => DemoState) => {
    setStateRaw(prev => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  };

  // Re-hydrate on mount in case localStorage changed between reloads
  useEffect(() => {
    setStateRaw(loadInitial());
  }, []);

  return (
    <DemoContext.Provider value={{ state, setState }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoState(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    throw new Error('useDemoState must be used within DemoStateProvider');
  }
  return ctx;
}


