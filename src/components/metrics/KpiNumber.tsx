'use client';
import React from 'react';

export default function KpiNumber({ value, label, delta, tone='perf' }:{
  value: string | number;
  label: string;
  delta?: number;
  tone?: 'engage'|'perf'|'opp'|'risk';
}) {
  return (
    <div className="flex items-center gap-4">
      <div>
        <div className="kpi text-[var(--type-h3)] font-semibold leading-none">{value}</div>
        <div className="text-xs subtle">{label}</div>
      </div>
      {typeof delta === 'number' && (
        <div className={`text-sm ${delta >= 0 ? 'text-opp' : 'text-risk'}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
        </div>
      )}
    </div>
  );
}
