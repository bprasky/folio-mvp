"use client";

import { useState, useEffect } from "react";
import { CreditsEditor } from "@/components/posting/CreditsEditor";
import type { CreditEntry } from "@/lib/posting/creditsSchema";

/**
 * ProjectCreditsCard — who else brought the project to life.
 *
 * This used to sit at the bottom of the Story tab, which meant a designer was
 * asked to name their collaborators only after they had finished writing about
 * the work. It belongs earlier: credits are known as soon as the rooms are, and
 * the draft generator reads them, so capturing them before the interview means
 * the article can reference the people involved.
 */
export default function ProjectCreditsCard({ projectId }: { projectId: string }) {
  const [credits, setCredits] = useState<CreditEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/posting/project/${projectId}/credits`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCredits(data.credits || []);
        }
      } catch (error) {
        console.error("[ProjectCreditsCard] Credits fetch failed:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleChange(newCredits: CreditEntry[]) {
    setCredits(newCredits);
    setSaving(true);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/credits`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: newCredits }),
      });
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits || newCredits);
      }
    } catch (error) {
      console.error("[ProjectCreditsCard] Credits save failed:", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-md border border-folio-border-subtle bg-surface-ground p-6 shadow-folio1">
      <h2 className="font-headline text-folio-h4 text-folio-text-primary">
        Project credits
      </h2>
      <p className="mt-2 text-folio-body text-folio-text-secondary">
        You brought the vision together. Your architect, builder, photographer and other
        collaborators each have a side of the story to tell — and an audience who could
        discover your work through theirs.
      </p>
      <p className="mt-2 text-folio-meta text-folio-text-secondary">
        As Folio opens to clients, we plan to automatically invite these collaborators to
        publish their perspectives, connected to your project. With your vendors included, one project could become
        10 or 20 stories that bring new people back to your work.
      </p>
      <p className="mt-2 mb-4 text-folio-meta text-folio-text-tertiary">
        Add the people who helped bring this project to life. Credits appear on your published
        post now. During the pilot, adding credits does not send automatic invitations.
      </p>
      <CreditsEditor credits={credits} onChange={handleChange} saving={saving} />
    </section>
  );
}
