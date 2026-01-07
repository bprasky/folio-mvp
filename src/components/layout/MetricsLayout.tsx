'use client';
import React from 'react';
import metricsTheme from '@/styles/metrics-theme';

export default function MetricsLayout({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="metrics min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/45 backdrop-blur-md px-4 md:px-6 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-perf" />
            <h1 className="text-base font-medium tracking-wide">{title ?? 'Folio Metrics'}</h1>
          </div>
          <span className="text-xs subtle">Measure what moves design.</span>
        </div>
      </header>

      <main className="mx-auto w-full px-4 md:px-6" style={{ maxWidth: metricsTheme.maxWidth }}>
        {children}
      </main>
    </div>
  );
}
