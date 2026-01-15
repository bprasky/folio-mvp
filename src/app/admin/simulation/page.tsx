import { Suspense } from "react";
import dynamic from "next/dynamic";

// Dynamically import the client component to avoid SSR issues with Three.js
const SimulationClient = dynamic(() => import("./simulation-client"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-200 folio-body">Loading visualization...</div>
    </div>
  ),
});

export default function SimulationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-slate-200 folio-body">Loading visualization...</div>
        </div>
      }
    >
      <SimulationClient />
    </Suspense>
  );
}
