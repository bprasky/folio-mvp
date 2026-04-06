// src/app/feed/states.tsx

import { RidgeCard } from "@/components/ui/ridge-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function EmptyFeedOutline() {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main */}
      <div className="col-span-12 lg:col-span-9">
        <RidgeCard padding="xl" className="text-center">
          <h2 className="folio-h2 text-folio-text-secondary mb-4">
            No projects yet
          </h2>
          <p className="folio-body text-folio-text-secondary mb-6">
            Be the first to share your work
          </p>
          <Link href="/projects/new">
            <Button variant="accent">
              Create Project
            </Button>
          </Link>
        </RidgeCard>
      </div>
      {/* Side */}
      <div className="col-span-12 lg:col-span-3 space-y-6">
        <RidgeCard padding="none" className="overflow-hidden">
          <div className="aspect-[4/5] w-full bg-surface-ground grid place-items-center">
            <span className="folio-meta text-folio-text-tertiary">Trending Projects</span>
          </div>
        </RidgeCard>

        <RidgeCard padding="none" className="overflow-hidden">
          <div className="aspect-[4/5] w-full bg-surface-ground grid place-items-center">
            <span className="folio-meta text-folio-text-tertiary">AI Suggested Matches</span>
          </div>
        </RidgeCard>
      </div>
    </div>
  );
}
