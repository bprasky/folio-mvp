import { Suspense } from "react";
import dynamic from "next/dynamic";

// Dynamically import the client component to avoid SSR issues with Three.js
const SimulationClient = dynamic(() => import("./simulation-client"), {
  ssr: false,
  loading: () => <div className="p-8 text-slate-200">Loading…</div>,
});

export default function SimulationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-200">Loading…</div>}>
      <SimulationClient />
    </Suspense>
  );
}

