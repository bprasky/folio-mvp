"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PrivateSpotlightInterview,
  SpotlightSelections,
} from "./PrivateSpotlightInterview";

export function PrivateSpotlightWorkspace({
  projectId,
  actorId,
}: {
  projectId: string;
  actorId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1>Private spotlight workspace</h1>
      <SpotlightSelections projectId={projectId} />
      <Button variant="accent" onClick={() => setOpen(true)}>
        Start or resume interview
      </Button>
      {open && (
        <PrivateSpotlightInterview
          projectId={projectId}
          actorId={actorId}
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  );
}
