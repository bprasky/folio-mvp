'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ProjectGuideUploads } from '@/components/interviews/ProjectGuideUploads';

/** Empty completed projects enter the same room workspace as the short create form. */
export default function NewProjectWizard({ project, canScrape }: {
  project: { id: string; title: string };
  canScrape: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Link href="/projects" className="folio-meta text-folio-text-secondary underline underline-offset-4">Back to projects</Link>
      <header>
        <h1 className="font-headline text-folio-h2">{project.title}</h1>
        <p className="mt-3 folio-body text-folio-text-secondary">Add your photos, then organize them into rooms.</p>
      </header>
      <ProjectGuideUploads
        projectId={project.id}
        canImport={canScrape}
        onAdded={(_id, _photos, complete) => {
          if (!complete) return;
          const next = new URLSearchParams(search.toString());
          next.set('view', 'media');
          next.set('step', 'rooms');
          next.set('action', 'sort-rooms');
          router.replace(`/project/${encodeURIComponent(project.id)}?${next}`);
          router.refresh();
        }}
      />
    </main>
  );
}
