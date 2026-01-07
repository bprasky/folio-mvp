"use client";
import { useDemoStore } from "@/lib/demo/demoStore";

export function DemoModeIndicator() {
  const { demoMode } = useDemoStore();

  if (!demoMode) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 text-xs font-medium">
      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
      Demo Mode
    </div>
  );
}





