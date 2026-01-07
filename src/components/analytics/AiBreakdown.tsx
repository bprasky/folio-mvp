'use client';
import { ReactNode } from 'react';

export function AiBreakdown({ 
  what, why, next = [], receipts 
}: { 
  what: string; 
  why: string; 
  next?: string[]; 
  receipts?: ReactNode;
}) {
  return (
    <div className="mt-2 pt-2 border-t border-white/10 subtle text-sm leading-5 space-y-1">
      <div><span className="opacity-70">What:</span> {what}</div>
      <div><span className="opacity-70">Why:</span> {why}</div>
      <div className="flex gap-2 mt-2">
        {next?.map((action, i) => (
          <button key={i} className="chip px-3 py-1.5 text-sm">
            {action}
          </button>
        )) || []}
      </div>
      {receipts && (
        <div className="pt-4 border-t border-white/10">
          {receipts}
        </div>
      )}
    </div>
  );
}