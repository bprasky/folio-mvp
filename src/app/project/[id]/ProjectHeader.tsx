import { format, formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import type { EditorialState } from '@/lib/editorial/getEditorialState';

function editorialStatusLabel(state: EditorialState): string {
  if (state === 'PUBLISHED') return 'Published';
  if (state === 'EMPTY') return 'Drafts';
  return 'In progress';
}

function editorialStatusDotClass(state: EditorialState): string {
  if (state === 'PUBLISHED') return 'bg-[#6FA67A]';
  if (state === 'EMPTY') return 'bg-folio-text-tertiary';
  return 'bg-folio-gold-ornament';
}

function formatMonthYear(date: Date | string): string {
  return format(new Date(date), 'MMM yyyy');
}

function formatRelative(date: Date | string): string {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    return formatDistanceToNowStrict(d, { addSuffix: true });
  }
  return format(d, 'MMM d');
}

const Sep = () => (
  <span className="inline-block w-1 h-1 rounded-full bg-folio-text-tertiary" aria-hidden />
);


export interface ProjectHeaderProps {
  project: {
    id: string;
    title: string;
    category?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  editorialState: EditorialState;
}

export default function ProjectHeader({ project, editorialState }: ProjectHeaderProps) {
  const sLabel = editorialStatusLabel(editorialState);
  const dotClass = editorialStatusDotClass(editorialState);
  return (
    <header className="pb-6">
      <div>
        {/* H1 — --type-h1 (48px/1.10). Was a hard-coded 72px, 1.5x the scale
            with no off-scale comment, which on a 1440x900 laptop was 24px of
            the ~723px of chrome standing between the designer and their photos. */}
        <h1 className={"font-headline italic text-folio-h1 tracking-[-0.015em] text-folio-text-primary" /* folio-design-system: off-scale */}>
          {project.title}
        </h1>

        {/* Meta row — status and category ride here rather than in a badge row
            of their own above the H1: that row cost 36px to say what the
            breadcrumb and the stepper already say. Room/item counts stay
            omitted; the progress tracker's stepper is the single owner of
            project counts. */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-folio-text-secondary">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-folio-surface-elevated text-folio-text-secondary text-[length:var(--type-eyebrow)] font-medium tracking-[var(--ls-wide)] uppercase">
            <span className={cn('w-1.5 h-1.5 rounded-full', dotClass)} />
            {sLabel}
          </span>
          {project.category && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-folio-border-subtle text-folio-text-secondary text-[length:var(--type-eyebrow)] font-medium tracking-[var(--ls-wide)] uppercase">
              {project.category}
            </span>
          )}
          <Sep />
          <span>Started {formatMonthYear(project.createdAt)}</span>
          <Sep />
          <span>Last edit {formatRelative(project.updatedAt)}</span>
        </div>
      </div>
    </header>
  );
}
