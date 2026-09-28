'use client';

import Link from 'next/link';
import { Check, ArrowRight, Plus, FileText, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TRACKER_TYPES,
  IMPORT_CARDS,
  stepHref,
  type TrackerState,
  type TrackerStep,
  type TrackerAction,
  type ImportCard,
} from '@/lib/publish/computeTrackerState';

interface ProjectProgressTrackerProps {
  projectId: string;
  state: TrackerState;
  /** The surface currently on screen, so the tracker can tell whether its own
   *  CTA would route there. */
  currentView: string;
  /**
   * When the step's surface already owns its next-action inline (the Tags step
   * opens straight into the tagging surface), collapse to just the stepper so
   * the tracker's cards don't duplicate it.
   */
  hideNextAction?: boolean;
}

const IMPORT_ICONS = {
  document: FileText,
  cursor: MousePointerClick,
} as const;

/**
 * Turn a CTA action into a route. The tracker stays decoupled from the action
 * UIs: it routes to the surface that hosts them and names the flow via the
 * `action` query param. The Media surface reads that param and opens the
 * matching existing flow (uploader / imports / materials / tag review /
 * interview). Publish routes to the Publish view instead. This keeps a single
 * set of action handlers in the codebase.
 */
function actionHref(projectId: string, action: TrackerAction): string {
  if (action === 'publish') {
    return `/project/${projectId}?view=publish`;
  }
  // Explicit Start/Continue actions open the interview hosted by Story. The
  // stepper's plain Story link remains a visit to saved answers and coverage.
  if (action === 'interview') {
    return `/project/${projectId}?view=story&action=interview`;
  }
  return `/project/${projectId}?view=media&action=${action}`;
}

/**
 * ProjectProgressTracker — the guided "what's next" region at the top of the
 * project detail view. One stepper owns the counts (rule 1); one next-action
 * zone sits directly below it and changes with the current step (rule 3).
 */
export default function ProjectProgressTracker({
  projectId,
  state,
  currentView,
  hideNextAction = false,
}: ProjectProgressTrackerProps) {
  const { steps, currentIndex, reachedIndex, materialsIndex, materialsExist, type, endCap } =
    state;
  const def = TRACKER_TYPES[type];
  const current = steps[currentIndex];
  // Merge any per-render override (e.g. the "Continue interview" variant when an
  // interview is already in progress) over the step's default copy.
  const copy = { ...def.copy[current.key], ...(state.currentCopyOverride ?? {}) };

  // Materials mode: the import cards fill the zone only on the materials step
  // and only until materials exist. Once they exist, the zone shows that step's
  // normal next-action and the cards collapse to a compact bar (rule 4).
  const showImportCards = currentIndex === materialsIndex && !materialsExist;
  const showCollapsedBar = materialsExist && !showImportCards;
  const onLastStep = currentIndex === steps.length - 1;

  // Story already owns its Start/Resume control; Publish owns its publishing
  // footer. Keep one next action on either surface by collapsing to the stepper.
  //
  // Note this reads the MERGED copy, so a publish step whose gate is closed —
  // PUBLISH_BLOCKED_COPY swaps the action to `sort-rooms` / `tag` — keeps its
  // zone. That is the one thing the Publish surface cannot say for itself: why
  // a finished draft still can't ship.
  const ctaRoutesToCurrentSurface =
    (copy.action === 'interview' && currentView === 'story') ||
    (copy.action === 'publish' && currentView === 'publish');

  // The interview resume screen needs navigation, not another progress card.
  if (currentView === 'story') {
    return (
      <nav aria-label="Project steps" className="flex flex-wrap gap-1 border-b border-folio-border-subtle pb-3">
        {steps.map(step => step.locked ? (
          <span key={step.key} aria-disabled="true" className="px-3 py-2 text-folio-ui text-folio-text-tertiary">{step.label}</span>
        ) : (
          <Link key={step.key} href={stepHref(projectId, step.key)} aria-current={step.key === 'story' ? 'step' : undefined}
            className={cn('rounded-sm px-3 py-2 text-folio-ui transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold',
              step.key === 'story' ? 'bg-surface-ground font-medium text-folio-text-primary' : 'text-folio-text-secondary hover:bg-surface-ground')}>
            {step.label}
          </Link>
        ))}
      </nav>
    );
  }

  // The surface below owns this step's next-action inline — show only progress.
  if (hideNextAction || ctaRoutesToCurrentSurface) {
    return (
      <section
        aria-label="Project progress"
        className="rounded-[20px] border border-folio-border-subtle bg-surface-canvas overflow-hidden"
      >
        <Stepper
          steps={steps}
          projectId={projectId}
          reachedIndex={reachedIndex}
          hideDownTick
        />
      </section>
    );
  }

  return (
    <section
      aria-label="Project progress"
      className="rounded-[20px] border border-folio-border-subtle bg-surface-canvas overflow-hidden"
    >
      <Stepper steps={steps} projectId={projectId} reachedIndex={reachedIndex} />

      <div className="px-8 pb-6 pt-1">
        {showImportCards ? (
          <MaterialsZone projectId={projectId} copy={copy} />
        ) : (
          <NextActionZone
            projectId={projectId}
            copy={copy}
            showCollapsedBar={showCollapsedBar}
          />
        )}

        {endCap && onLastStep && (
          <p className="mt-6 text-[length:var(--type-meta)] text-folio-text-tertiary">{endCap}</p>
        )}
      </div>

    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Stepper
 * ------------------------------------------------------------------------- */

const MARKER = 40; // px — circle diameter
const MARKER_CENTER = MARKER / 2;

function Stepper({
  steps,
  projectId,
  reachedIndex,
  hideDownTick = false,
}: {
  steps: TrackerStep[];
  projectId: string;
  /** How far the project has got — fills the track, and matches the markers. */
  reachedIndex: number;
  hideDownTick?: boolean;
}) {
  const n = steps.length;
  const activeIndex = Math.max(0, steps.findIndex(s => s.active));
  // Marker centers sit at (i + 0.5)/n of the row width. The track spans the
  // first center to the last center; the filled portion runs to the current
  // center.
  const edge = 50 / n; // % from row edge to first/last marker center
  // The fill shows real progress, so it tracks what's been reached — stepping
  // back to review a finished step must never look like progress was lost.
  const filledWidth = (reachedIndex / n) * 100; // % of row width

  return (
    <div className="relative px-8 pt-6 pb-5">
      <div className="relative flex">
        {/* 2px track behind the markers */}
        <div
          className="absolute h-0.5 bg-folio-stone-100"
          style={{ top: MARKER_CENTER - 1, left: `${edge}%`, right: `${edge}%` }}
          aria-hidden
        />
        <div
          className="absolute h-0.5 bg-folio-stone-700"
          style={{ top: MARKER_CENTER - 1, left: `${edge}%`, width: `${filledWidth}%` }}
          aria-hidden
        />

        {steps.map(step => (
          <StepMarker
            key={step.key}
            step={step}
            href={step.locked ? undefined : stepHref(projectId, step.key)}
          />
        ))}

        {/* Down-tick: a rotated square centered under the current step, pointing
            into the next-action zone below. Hidden when there is no zone. */}
        {!hideDownTick && (
          <span
            className="absolute -bottom-[7px] w-3 h-3 rotate-45 bg-surface-canvas border-r border-b border-folio-border-subtle"
            style={{
              left: `${((activeIndex + 0.5) / n) * 100}%`,
              transform: 'translateX(-50%) rotate(45deg)',
            }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

function StepMarker({ step, href }: { step: TrackerStep; href?: string }) {
  const { state, label, count, remaining, index, active, locked } = step;
  const isDone = state === 'done';
  // A step the designer has moved past can still have work left in it (the Story
  // step opens before every photo is tagged). Say so under the marker instead of
  // rendering it as unreached — the step stays checked, navigable, and honest.
  const openWork = isDone && typeof remaining === 'number' && remaining > 0;

  const body = (
    <>
      {/* Soft gold backing behind the step being viewed */}
      {active && (
        <span
          className="absolute -inset-x-1 -top-1.5 -bottom-1.5 rounded-2xl bg-folio-gold-ornament/12"
          aria-hidden
        />
      )}

      <span
        className={cn(
          'relative inline-flex items-center justify-center rounded-full text-sm font-semibold transition-all duration-[220ms]',
          // The viewed step always reads as active, finished or not.
          active && 'bg-folio-gold-ornament text-white ring-4 ring-folio-gold-ornament/20',
          !active && isDone && 'bg-[#161614] text-white',
          // Unreached but reachable (e.g. the interview before tagging is done):
          // must read as somewhere you can go. A faint outline made it look
          // identical to a locked step, so an unlocked step was indistinguishable
          // from a disabled one.
          !active && !isDone && !locked &&
            'border-2 border-folio-stone-700 text-folio-text-primary',
          !active && !isDone && locked &&
            'border border-folio-stone-100 text-folio-text-tertiary opacity-45',
        )}
        style={{ width: MARKER, height: MARKER }}
      >
        {isDone ? <Check className="w-5 h-5" aria-hidden /> : index + 1}
      </span>

      <div className="relative flex flex-col items-center">
        <span
          className={cn(
            'text-[length:var(--type-ui)] leading-none',
            // A reachable step is a link, and in the publishing flow the stepper
            // is the page's ONLY navigation — ProjectTabs renders nothing there.
            // Opacity-on-hover was the whole affordance, so nothing said these
            // were clickable. A dotted underline costs no height and says it.
            !locked && 'underline decoration-dotted decoration-folio-stone-100 underline-offset-4',
            active && 'font-semibold text-folio-accent-700',
            !active && isDone && 'font-medium text-folio-text-primary',
            !active && !isDone && !locked && 'font-medium text-folio-text-secondary',
            !active && !isDone && locked && 'text-folio-text-tertiary opacity-60',
          )}
          aria-current={active ? 'step' : undefined}
        >
          {label}
        </span>
        {openWork ? (
          <span className={"mt-1 text-[12px] font-medium text-folio-gold-ornament tabular-nums" /* folio-design-system: off-scale */}>
            {remaining} left
          </span>
        ) : (
          isDone &&
          typeof count === 'number' && (
            <span className={"mt-1 text-[12px] text-folio-text-tertiary tabular-nums" /* folio-design-system: off-scale */}>
              {count}
            </span>
          )
        )}
      </div>
    </>
  );

  const shared = 'relative flex-1 flex flex-col items-center gap-2.5 z-[1]';

  // Every step up to the frontier is real navigation — back to finished work, or
  // forward to the step progress has unlocked. Locked steps stay inert; this only
  // moves the designer between surfaces, it never advances real completion.
  if (!href) {
    return (
      <div
        className={cn(shared, locked && 'cursor-not-allowed')}
        title={locked ? `${label} unlocks as you finish the earlier steps` : undefined}
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      title={`Go to ${label}`}
      className={cn(
        shared,
        'rounded-2xl transition-opacity duration-[220ms] hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40',
      )}
    >
      {body}
    </Link>
  );
}

/* ----------------------------------------------------------------------------
 * Next-action zone — normal mode
 * ------------------------------------------------------------------------- */

/**
 * The next-action zone, laid out as a single band: eyebrow + headline + body on
 * the left, CTA on the right.
 *
 * It used to stack those four on top of each other, which cost 213px of the
 * page's ~723px of chrome — and the copy is static per step, so a designer
 * returning to the project for the tenth time re-read the same paragraph of
 * onboarding guidance before reaching their photos. The band says the same
 * thing in 123px and lets a full row of the work surface clear the fold.
 */
function NextActionZone({
  projectId,
  copy,
  showCollapsedBar,
}: {
  projectId: string;
  copy: import('@/lib/publish/computeTrackerState').StepCopy;
  showCollapsedBar: boolean;
}) {
  return (
    <div>
      {showCollapsedBar && <CollapsedMaterialsBar projectId={projectId} />}

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--type-eyebrow)] font-semibold uppercase tracking-[var(--ls-eyebrow)] text-folio-gold-ornament">
            {copy.ready ? 'Ready' : 'Next'} · {copy.eyebrow}
          </p>
          <h2 className="mt-2 text-[length:var(--type-h4)] font-semibold leading-tight text-folio-text-primary">
            {copy.headline}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[length:var(--type-meta)] leading-snug text-folio-text-secondary">
            {copy.body}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-5">
          {copy.secondary && (
            <Link
              href={`/project/${projectId}?view=publish`}
              className="text-[length:var(--type-ui)] font-medium text-folio-text-tertiary transition-colors duration-150 hover:text-folio-text-secondary"
            >
              {copy.secondary}
            </Link>
          )}
          <PrimaryCta href={actionHref(projectId, copy.action)}>{copy.cta}</PrimaryCta>
        </div>
      </div>
    </div>
  );
}

function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={"group inline-flex items-center gap-2 rounded-[12px] bg-[var(--accent)] px-6 py-3.5 text-[16px] font-semibold text-white shadow-[0_4px_14px_rgba(184,132,92,0.30)] transition-all duration-[220ms] hover:bg-[var(--accent-hover)] hover:shadow-[0_6px_18px_rgba(184,132,92,0.38)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40" /* folio-design-system: off-scale */}
    >
      {children}
      <ArrowRight className="w-4 h-4 transition-transform duration-[220ms] group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ----------------------------------------------------------------------------
 * Next-action zone — materials mode (import cards)
 * ------------------------------------------------------------------------- */

function MaterialsZone({
  projectId,
  copy,
}: {
  projectId: string;
  copy: import('@/lib/publish/computeTrackerState').StepCopy;
}) {
  return (
    <div>
      <p className="text-[length:var(--type-eyebrow)] font-semibold uppercase tracking-[var(--ls-eyebrow)] text-folio-gold-ornament">
        Next · {copy.eyebrow}
      </p>
      <h2 className="mt-2 text-[length:var(--type-h4)] font-semibold leading-tight text-folio-text-primary">
        {copy.headline}
      </h2>
      <p className="mt-2 max-w-2xl text-[length:var(--type-body)] leading-relaxed text-folio-text-secondary">
        {copy.body}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {IMPORT_CARDS.map((card, i) => (
          <ImportCardView
            key={card.key}
            card={card}
            primary={i === 0}
            href={actionHref(projectId, card.action)}
          />
        ))}
      </div>
    </div>
  );
}

function ImportCardView({
  card,
  primary,
  href,
}: {
  card: ImportCard;
  primary: boolean;
  href: string;
}) {
  const Icon = IMPORT_ICONS[card.icon];
  return (
    <div
      className={cn(
        'flex flex-col rounded-[14px] border bg-surface-canvas p-5 transition-colors duration-[220ms]',
        primary ? 'border-[var(--accent)]' : 'border-folio-border-subtle',
      )}
    >
      <span
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-[10px]',
          primary
            ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
            : 'bg-surface-ground text-folio-text-secondary',
        )}
      >
        <Icon className="w-5 h-5" aria-hidden />
      </span>
      <h3 className="mt-3.5 text-[length:var(--type-body)] font-semibold text-folio-text-primary">
        {card.name}
      </h3>
      <p className={"mt-1 font-metricsMono text-[12px] tracking-tight text-folio-text-tertiary" /* folio-design-system: off-scale */}>
        {card.formats}
      </p>
      <Link
        href={href}
        className={cn(
          'mt-5 inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[length:var(--type-ui)] font-semibold transition-colors duration-[220ms]',
          primary
            ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
            : 'border border-folio-border-subtle text-folio-text-secondary hover:border-folio-border-strong hover:text-folio-text-primary',
        )}
      >
        {card.cta}
      </Link>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Collapsed materials bar
 * ------------------------------------------------------------------------- */

function CollapsedMaterialsBar({ projectId }: { projectId: string }) {
  return (
    <div className="mb-6 flex items-center gap-4 rounded-[14px] bg-surface-ground px-5 py-3.5">
      {/* Overlapping icon chips */}
      <div className="flex items-center -space-x-2">
        {(['document', 'cursor'] as const).map(key => {
          const Icon = IMPORT_ICONS[key];
          return (
            <span
              key={key}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-folio-border-subtle bg-surface-canvas text-folio-text-secondary"
            >
              <Icon className="w-3.5 h-3.5" aria-hidden />
            </span>
          );
        })}
      </div>

      <p className="flex-1 text-[length:var(--type-ui)] text-folio-text-secondary">
        <span className="font-semibold text-folio-text-primary">Materials imported.</span>{' '}
        Counts live in the tracker above.
      </p>

      <Link
        href={actionHref(projectId, 'materials')}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-folio-border-subtle bg-surface-canvas px-3.5 py-2 text-[length:var(--type-ui)] font-medium text-folio-text-secondary transition-colors duration-[220ms] hover:border-folio-border-strong hover:text-folio-text-primary"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden />
        Add more
      </Link>
    </div>
  );
}
