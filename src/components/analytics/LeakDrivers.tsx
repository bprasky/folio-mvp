"use client";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface LeakDriver {
  driver: string;
  impactPts: number;
  why: string;
  action?: { label: string };
}

interface LeakDriversProps {
  drivers: LeakDriver[];
}

export function LeakDrivers({ drivers }: LeakDriversProps) {
  return (
    <div className="chart-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-[var(--amber)]" />
        <div className="font-semibold text-[#1F2937]">Leak Drivers</div>
      </div>
      <div className="h-key mb-3">Top factors behind conversion gaps and the quickest fixes.</div>
      
      <div className="divide-y divide-[var(--grid)]">
        {drivers.slice(0, 3).map((d, i) => (
          <div key={i} className="py-3 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-[#111827] mb-1">{d.driver}</div>
              <div className="text-xs text-[#6B7280] leading-relaxed">{d.why}</div>
              {d.action && (
                <div className="mt-1 text-xs text-[var(--teal)]">→ {d.action.label}</div>
              )}
            </div>
            <div className={cn(
              "num text-sm font-semibold px-3 py-1 rounded whitespace-nowrap",
              d.impactPts < 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
            )}>
              {d.impactPts > 0 ? '+' : ''}{d.impactPts} pts
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 text-xs h-key leading-relaxed">
        Impact measured in conversion points vs cohort baseline. Fixes derived from similar vendor interventions.
      </div>
    </div>
  );
}








