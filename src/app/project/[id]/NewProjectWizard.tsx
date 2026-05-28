'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

/**
 * New Project Wizard — guided setup for completed ("PAST" timeline) projects.
 *
 * Phase 3a ships the shell + fork wiring. The five linear steps
 * (Photos → Label Rooms → Presentation/Spec → Revise Tags → Interview CTA)
 * are implemented in Phases 3b–3d. `canScrape` gates the portfolio-URL path
 * (wired to the premium gate in Phase 3b).
 */
interface NewProjectWizardProps {
  project: {
    id: string;
    title: string;
    timeline?: 'PAST' | 'PRESENT' | 'FUTURE' | null;
    [key: string]: unknown;
  };
  canScrape: boolean;
}

export default function NewProjectWizard({ project }: NewProjectWizardProps) {
  const router = useRouter();

  const goToProject = () => {
    router.push(`/project/${project.id}?view=media`);
  };

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Back Navigation */}
      <div className="p-4 bg-surface-ground border-b border-folio-border-subtle">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/projects"
            className="inline-flex items-center text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors folio-ui"
          >
            <FaArrowLeft className="mr-2 w-3 h-3" /> Back to Projects
          </Link>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 pt-16 pb-24 text-center">
        <h1 className="font-serif italic text-2xl text-folio-text-primary tracking-tight">
          {project.title}
        </h1>
        <p className="mt-4 folio-body text-folio-text-secondary">
          Let&apos;s set up your completed project. The guided wizard is being
          assembled — for now you can jump straight into the project to add photos,
          rooms, and specs.
        </p>
        <button
          onClick={goToProject}
          className="accent-btn px-6 py-3 mt-8 mx-auto"
        >
          Continue to project
        </button>
      </main>
    </div>
  );
}
