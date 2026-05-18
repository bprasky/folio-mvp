'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface ProfilePreviewActionsProps {
  alreadyCompleted: boolean;
  canPublishProjects: boolean;
}

// Persistent CTA card from 17_ONBOARDING_FLOW Step 4.
// For Architect/Builder (Phase 1B publishing), the CTA is held back per the
// phase boundary in the spec.
export function ProfilePreviewActions({
  alreadyCompleted,
  canPublishProjects,
}: ProfilePreviewActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markComplete() {
    if (alreadyCompleted) return;
    try {
      await fetch('/api/onboarding/profile-preview/complete', {
        method: 'POST',
      });
    } catch {
      // Non-blocking — middleware will re-route if needed.
    }
  }

  async function handleUpload() {
    setBusy(true);
    await markComplete();
    router.replace('/designer/create?intent=publish_now&onboard=1');
  }

  async function handleImport() {
    setBusy(true);
    await markComplete();
    // Import agent flow per 13_IMPORT_AGENT_SPEC. Route may not exist yet;
    // fall back to the create flow with an import intent flag.
    router.replace('/designer/create?intent=import&onboard=1');
  }

  async function handleFinish() {
    setBusy(true);
    await markComplete();
    router.replace('/');
  }

  if (!canPublishProjects) {
    return (
      <div className="rounded-2xl border border-folio-border-subtle/70 bg-white/60 px-6 py-6 text-center space-y-4">
        <div className="folio-quote text-xl text-folio-text-primary">
          Publishing for your role is coming soon.
        </div>
        <p className="text-folio-text-secondary font-body text-sm">
          You're set up. We'll let you know when project publishing opens.
        </p>
        <Button
          variant="accent"
          size="lg"
          onClick={handleFinish}
          disabled={busy}
          className="min-w-[200px]"
        >
          Explore Folio →
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-folio-border-subtle/70 bg-white/60 px-6 py-6 text-center space-y-4">
      <div className="folio-quote text-xl text-folio-text-primary">
        Add your first project
      </div>
      <p className="text-folio-text-secondary font-body text-sm">
        Upload images, or import from a presentation you've already made.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
        <Button
          variant="accent"
          size="lg"
          onClick={handleUpload}
          disabled={busy}
          className="min-w-[180px]"
        >
          Upload images →
        </Button>
        <Button
          variant="ridge"
          size="lg"
          onClick={handleImport}
          disabled={busy}
          className="min-w-[180px]"
        >
          Import from presentation
        </Button>
      </div>
      <button
        type="button"
        onClick={handleFinish}
        disabled={busy}
        className="text-xs text-folio-text-tertiary hover:text-folio-text-secondary underline-offset-4 hover:underline"
      >
        I'll add a project later
      </button>
    </div>
  );
}
