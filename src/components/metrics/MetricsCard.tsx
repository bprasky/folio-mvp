'use client';
import React from 'react';

export default function MetricsCard({
  title, tone='perf', right, children, footer
}:{
  title: string;
  tone?: 'engage'|'perf'|'opp'|'risk';
  right?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const toneClass = tone==='engage'?'bg-engage':tone==='opp'?'bg-opp':tone==='risk'?'bg-risk':'bg-perf';
  return (
    <section className="card pad">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-medium">{title}</h3>
        <div className="flex items-center gap-2">{right}</div>
      </header>
      <div className="min-h-[220px]">{children}</div>
      {footer && <div className="mt-3 subtle text-sm">{footer}</div>}
      <span className={`block h-0.5 mt-4 rounded ${toneClass} opacity-90`} />
    </section>
  );
}
