// src/app/feed/states.tsx

import { GlassCard, EditorialHeadline, GlassButton } from "@/components/ui/glass";
import Link from "next/link";

export function EmptyFeedOutline() {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main */}
      <div className="col-span-12 lg:col-span-9">
        <GlassCard variant="subtle" padding="xl" rounded="2xl" className="text-center">
          <EditorialHeadline size="md" muted className="mb-4">
            No projects yet
          </EditorialHeadline>
          <p className="text-gray-600 mb-6">
            Be the first to share your work
          </p>
          <Link href="/projects/new">
            <GlassButton variant="primary">
              Create Project
            </GlassButton>
          </Link>
        </GlassCard>
      </div>
      {/* Side */}
      <div className="col-span-12 lg:col-span-3 space-y-6">
        <GlassCard variant="subtle" padding="none" rounded="2xl" className="overflow-hidden">
          <div className="aspect-[4/5] w-full bg-gray-100/50 grid place-items-center">
            <span className="text-xs text-gray-400">Trending Projects</span>
          </div>
        </GlassCard>

        <GlassCard variant="subtle" padding="none" rounded="2xl" className="overflow-hidden">
          <div className="aspect-[4/5] w-full bg-gray-100/50 grid place-items-center">
            <span className="text-xs text-gray-400">AI Suggested Matches</span>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}


