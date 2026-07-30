/**
 * computeTrackerState — the data layer for the Project Progress Tracker.
 *
 * The tracker is the guided "what's next" region at the top of the project
 * detail view. A wizard sets the project type at creation; this module turns
 * that type plus real completion signals into an adaptive step sequence and
 * the copy for the next-action zone.
 *
 * Pure and React-free so the project page (RSC) can derive it server-side and
 * hydrate a plain object to the client tracker.
 *
 * Seven rules this layer enforces (the component enforces the rest):
 *   1. The stepper owns the counts — they live on `TrackerStep.count`.
 *   7. The tracker adapts to type — `TRACKER_TYPES` defines a distinct sequence,
 *      materials step, and copy per type; steps that don't apply never appear.
 *
 * `currentStep` is derived from real completion (the first incomplete step),
 * never from free clicking. The prototype's per-type "default current" values
 * are demo seeds only and are intentionally not encoded here.
 */

export type TrackerType = 'completed' | 'inProgress' | 'concept';
export type StepState = 'done' | 'current' | 'upcoming';

/**
 * The wizard's timeline → tracker type. PRESENT is work in flight, FUTURE is a
 * concept, and PAST is finished work headed for publication.
 *
 * A missing timeline (projects created before the wizard captured one) reads as
 * `completed`: the publishing sequence is the only one that can serve a project
 * we know nothing else about, since it's the one with a Story and a Publish step.
 *
 * Every consumer must classify a project through this function. When the page
 * derived the tracker type one way (null → completed, so the stepper offered
 * Tags/Story/Publish) and its publishing-flow gate another (`timeline === 'PAST'`
 * only, so the Story surface stayed hidden and `?view=story` fell back to the
 * media view), the Story step pointed at a surface the page then refused to
 * render — the Tags screen answered both URLs.
 */
export function trackerTypeForTimeline(timeline: string | null | undefined): TrackerType {
  if (timeline === 'PRESENT') return 'inProgress';
  if (timeline === 'FUTURE') return 'concept';
  return 'completed';
}

/**
 * The action a CTA dispatches. The tracker turns these into a route that the
 * Media surface consumes (`?view=media&action=<X>`) to open the matching
 * existing flow. `publish` is the exception: it routes to the Publish view.
 */
export type TrackerAction =
  | 'upload'
  | 'sort-rooms'
  | 'import-doc'
  | 'materials'
  | 'tag'
  | 'tag-by-hand'
  | 'interview'
  | 'publish';

/** Copy for one step's next-action zone. Conviction-driven, direct, no hedging. */
export interface StepCopy {
  /** The phrase after the "Next ·" / "Ready ·" eyebrow, e.g. "Tag products". */
  eyebrow: string;
  headline: string;
  body: string;
  /** Primary CTA label. The most prominent interactive element — never disabled. */
  cta: string;
  /** The flow the primary CTA opens. */
  action: TrackerAction;
  /** Optional secondary text button. */
  secondary?: string;
  /** Final step: the eyebrow reads "Ready ·" instead of "Next ·". */
  ready?: boolean;
}

export interface TypeDef {
  label: string;
  steps: Array<{ key: string; label: string }>;
  /** Which step is the materials/import step (where import cards live). */
  materialsKey: string;
  /** End-cap note shown under the zone for non-publishing types. */
  endCap?: string;
  copy: Record<string, StepCopy>;
}

/**
 * One import source card on the materials step. The first card is primary
 * (accent border + solid button); the rest are ghost. `formats` renders in
 * IBM Plex Mono.
 */
export interface ImportCard {
  key: string;
  /** Lucide icon name resolved by the component. */
  icon: 'document' | 'cursor';
  name: string;
  /** Short sub-line under the name (formats, or a hint for the manual path). */
  formats: string;
  cta: string;
  /** The flow this card opens. */
  action: TrackerAction;
}

/**
 * The materials step gets products onto photos two ways: import a document and
 * let us extract the products, or tag by hand. We take one document upload and
 * parse it ourselves rather than making the designer pick a file type. URL
 * tagging is intentionally absent here — it belongs to a specific photo inside
 * the manual tagger, not as a project-wide import.
 */
export const IMPORT_CARDS: ImportCard[] = [
  {
    key: 'document',
    icon: 'document',
    name: 'Import a document',
    formats: 'PDF · PPTX · XLSX · CSV',
    cta: 'Import',
    action: 'import-doc',
  },
  {
    key: 'manual',
    icon: 'cursor',
    name: 'Tag by hand',
    formats: 'Click products on each photo',
    cta: 'Start tagging',
    action: 'tag-by-hand',
  },
];

/**
 * Adaptive sequences + copy per type. Exact strings live here so the tracker
 * has one source of truth. Room-naming guidance is baked into the Rooms-step
 * body copy (rule 6), never surfaced as a floating banner.
 */
export const TRACKER_TYPES: Record<TrackerType, TypeDef> = {
  completed: {
    label: 'Completed',
    steps: [
      { key: 'photos', label: 'Photos' },
      { key: 'rooms', label: 'Rooms' },
      { key: 'tags', label: 'Tags' },
      { key: 'story', label: 'Story' },
      { key: 'publish', label: 'Publish' },
    ],
    materialsKey: 'tags',
    copy: {
      photos: {
        eyebrow: 'Add photos',
        headline: 'Bring the finished work in',
        body: 'Upload the photography that shows the project at its best. This is the foundation every reader sees first.',
        cta: 'Add photos',
        action: 'upload',
      },
      rooms: {
        eyebrow: 'Sort into rooms',
        headline: 'Group the photos by room',
        body: 'Name each room the way you spoke about it on site. "Primary Bath," not "Bathroom 2." Specific names read like a designer wrote them, because one did.',
        cta: 'Sort rooms',
        action: 'sort-rooms',
      },
      tags: {
        eyebrow: 'Tag products',
        headline: 'Tag the products in your photos',
        body: 'A tagged photo tells readers exactly what they are looking at and where to buy it. Untagged photos still publish, but they cannot earn.',
        cta: 'Tag products',
        action: 'tag',
      },
      story: {
        eyebrow: 'Tell the story',
        headline: 'Say why this project matters',
        body: 'A short interview turns a gallery into an editorial. Answer a few questions and we write the draft for you.',
        cta: 'Start interview',
        action: 'interview',
        secondary: 'Skip story for now',
      },
      publish: {
        eyebrow: 'Publish',
        headline: 'Send it to the world',
        body: 'Everything is in place. Publish to make this project public, shareable, and ready to earn.',
        cta: 'Publish project',
        action: 'publish',
        ready: true,
      },
    },
  },

  inProgress: {
    label: 'In Progress',
    steps: [
      { key: 'photos', label: 'Photos' },
      { key: 'rooms', label: 'Rooms' },
      { key: 'products', label: 'Products' },
    ],
    materialsKey: 'products',
    endCap: 'Publishing unlocks once you mark the project complete.',
    copy: {
      photos: {
        eyebrow: 'Add photos',
        headline: 'Start with what you have',
        body: 'Progress shots, samples, installs in flight. Add whatever documents the project as it stands today.',
        cta: 'Add photos',
        action: 'upload',
      },
      rooms: {
        eyebrow: 'Sort into rooms',
        headline: 'Group the photos by room',
        body: 'Name each room the way you spoke about it on site. "Primary Bath," not "Bathroom 2." Specific names keep the project legible as it grows.',
        cta: 'Sort rooms',
        action: 'sort-rooms',
      },
      products: {
        eyebrow: 'Add products',
        headline: 'Build the product list as you go',
        body: 'Import the deck or the links you are already working from. Every product you add now is one you will not chase down at the finish.',
        cta: 'Add products',
        action: 'materials',
      },
    },
  },

  concept: {
    label: 'Concept',
    steps: [
      { key: 'references', label: 'References' },
      { key: 'spaces', label: 'Spaces' },
      { key: 'products', label: 'Products' },
      { key: 'share', label: 'Share' },
    ],
    materialsKey: 'products',
    endCap: 'This stays private until you choose to share it.',
    copy: {
      references: {
        eyebrow: 'Add references',
        headline: 'Collect the direction',
        body: 'Pull together the images that set the tone. References are the language you will use to pitch the idea.',
        cta: 'Add references',
        action: 'upload',
      },
      spaces: {
        eyebrow: 'Define spaces',
        headline: 'Name the spaces you are designing',
        body: 'Group references by the space they belong to. Name each one plainly, the way you would describe it to the client.',
        cta: 'Add spaces',
        action: 'sort-rooms',
      },
      products: {
        eyebrow: 'Add products',
        headline: 'Specify the pieces you have in mind',
        body: 'Import the deck or the links you are sourcing from. A concept with real products reads as a plan, not a mood board.',
        cta: 'Add products',
        action: 'materials',
      },
      share: {
        eyebrow: 'Share',
        headline: 'Send the concept to your client',
        body: 'Share a private link so the client sees the direction exactly as you built it. Nothing goes public.',
        cta: 'Share concept',
        action: 'publish',
        ready: true,
      },
    },
  },
};

/**
 * Copy shown on the interview/Story step when an interview is already in
 * progress (answers saved, no draft generated yet). Swaps the "start" framing
 * for a "continue" one so a designer who stepped out mid-interview is told,
 * plainly, that their progress is kept and reachable. Lives here with the rest
 * of the tracker copy so there is one source of truth.
 */
export const STORY_IN_PROGRESS_COPY: Partial<StepCopy> = {
  eyebrow: 'Continue your story',
  headline: 'Pick up where you left off',
  body: 'Your interview answers are saved. Continue where you stopped or adjust what you have — nothing is lost.',
  cta: 'Continue interview',
};

/**
 * Where a step lives. The tracker is real navigation, so each step names the
 * surface that owns it:
 *  - the story step → the Story tab (interview, answers, generate)
 *  - the publish/share step → the Publish tab
 *  - everything else → the Media surface, with `step` naming which one, so the
 *    tracker can highlight it and Media can open the matching mode (the Tags
 *    step opens the tagging surface; Photos/Rooms open the workspace).
 */
export function stepHref(projectId: string, key: string): string {
  if (key === 'story') return `/project/${projectId}?view=story`;
  if (key === 'publish' || key === 'share') return `/project/${projectId}?view=publish`;
  return `/project/${projectId}?view=media&step=${key}`;
}

/**
 * Which step a surface corresponds to, for deriving the active step from the
 * current view. Media-hosted steps can't be told apart by view alone, so the
 * caller passes the `step` param through.
 */
export function activeStepKeyForView(
  view: string,
  stepParam: string | undefined,
  type: TrackerType,
): string | undefined {
  if (view === 'story') return 'story';
  if (view === 'publish') return type === 'concept' ? 'share' : 'publish';
  if (view === 'media' && stepParam) {
    // Only accept a key that exists for this tracker type.
    return TRACKER_TYPES[type].steps.some(s => s.key === stepParam) ? stepParam : undefined;
  }
  return undefined;
}

export interface TrackerStep {
  key: string;
  label: string;
  state: StepState;
  index: number;
  /** Secondary count shown under done steps. Omitted where no number applies. */
  count?: number;
  /**
   * Work still open on this step (photos left to tag, and so on). Set on a step
   * the designer has already moved past, so a checked marker can still say how
   * much is left instead of hiding it.
   */
  remaining?: number;
  /** True for the step the designer is currently looking at. */
  active: boolean;
  /**
   * True when the step isn't reachable yet. Everything up to `reachedIndex`
   * navigates, as does the interview step (never gated behind photos/products —
   * designers answer while tagging is still unfinished). Locked steps are inert.
   */
  locked: boolean;
}

export interface TrackerInput {
  type: TrackerType;
  /** Completion flag per step key. */
  complete: Record<string, boolean>;
  /** Secondary count per step key (optional). */
  counts?: Record<string, number | undefined>;
  /**
   * Work still open per step key (e.g. photos left to tag). Surfaced only on
   * steps the designer has already moved past, so the tracker can say "4 left"
   * on a step it marks as reached rather than silently rounding it to done.
   */
  remaining?: Record<string, number | undefined>;
  /** True once any product/material has been added to the project. */
  materialsExist: boolean;
  /**
   * True when an interview is in progress (answers saved but no draft generated
   * yet). When the current step is the interview step, its copy switches to the
   * "continue" variant (STORY_IN_PROGRESS_COPY).
   */
  interviewInProgress?: boolean;
  /**
   * The step the designer is currently viewing. The tracker follows the surface
   * they're on rather than always pointing at the frontier, so stepping back to
   * a finished step keeps the tracker in sync. Ignored when it names a locked
   * step or one that doesn't exist for this type.
   */
  activeKey?: string;
}

export interface TrackerState {
  type: TrackerType;
  label: string;
  steps: TrackerStep[];
  /**
   * The step being viewed — drives the next-action zone, the down-tick, and the
   * gold highlight. Equals `frontierIndex` unless the designer stepped back.
   */
  currentIndex: number;
  /**
   * The next thing to do: the first incomplete step. Drives the next-action
   * zone's default. NOT the marker states — see `reachedIndex`.
   */
  frontierIndex: number;
  /**
   * How far the project has actually got to. Drives the filled track, the
   * marker states and the navigation gate.
   *
   * This is deliberately not `frontierIndex`. The Story step is exempt from the
   * navigation gate (designers answer questions while tagging is unfinished), so
   * with `frontierIndex` alone the tracker could show an active Story step while
   * the earlier Tags step still rendered as never-reached — a hollow bubble
   * behind real progress. `reachedIndex` is monotonic over the whole sequence:
   * it takes the furthest of the frontier, any step completed beyond it, and the
   * interview step once answers exist. Steps behind it read as done and keep
   * their `remaining` count, so nothing is hidden and nothing is un-navigable.
   */
  reachedIndex: number;
  /** Index of the materials/import step within `steps`. */
  materialsIndex: number;
  materialsExist: boolean;
  endCap?: string;
  /**
   * Copy to merge over the CURRENT step's default copy (partial). Set when the
   * interview is in progress so the Story step reads "Continue interview".
   */
  currentCopyOverride?: Partial<StepCopy>;
}

/**
 * Derive the live tracker state. `frontierIndex` is the first incomplete step
 * (pinned to the last step once everything is complete, so the publish/share
 * action stays the prominent CTA); `reachedIndex` is how far the project has
 * actually got, which is what the markers and the navigation gate read;
 * `currentIndex` is the step being viewed, which follows `activeKey` when that
 * names a navigable step.
 */
export function deriveTrackerState(input: TrackerInput): TrackerState {
  const def = TRACKER_TYPES[input.type];
  const {
    complete,
    counts = {},
    remaining = {},
    materialsExist,
    interviewInProgress = false,
    activeKey,
  } = input;

  const firstIncomplete = def.steps.findIndex(s => !complete[s.key]);
  // What to do next: the first thing still open.
  const frontierIndex = firstIncomplete === -1 ? def.steps.length - 1 : firstIncomplete;
  const materialsIndex = def.steps.findIndex(s => s.key === def.materialsKey);

  // The interview step is deliberately not gated behind the photo and product
  // steps — designers routinely answer questions while tagging is still
  // unfinished, and the answers are the slowest part of the flow to collect.
  // Publishing stays gated, since it genuinely needs a draft to exist.
  const isInterviewStep = (index: number) => {
    const key = def.steps[index]?.key;
    return !!key && def.copy[key]?.action === 'interview';
  };

  // How far the project has actually got. Monotonic, so the stepper can never
  // show an unreached step behind a reached one: the frontier, plus any later
  // step that is already complete, plus the interview step once it's underway.
  let reachedIndex = frontierIndex;
  def.steps.forEach((s, index) => {
    if (index <= reachedIndex) return;
    if (complete[s.key] || (interviewInProgress && isInterviewStep(index))) {
      reachedIndex = index;
    }
  });

  // What the designer may navigate to: anything up to what's been reached, plus
  // the interview step.
  const navigable = (index: number) => index <= reachedIndex || isInterviewStep(index);

  // The viewed step. Stepping back to a finished step is always allowed; asking
  // for one that isn't navigable falls back to the next thing to do.
  const requestedIndex = activeKey ? def.steps.findIndex(s => s.key === activeKey) : -1;
  const currentIndex =
    requestedIndex >= 0 && navigable(requestedIndex) ? requestedIndex : frontierIndex;

  const steps: TrackerStep[] = def.steps.map((s, index) => {
    // Styling tracks what's been reached, so navigating back never makes a step
    // the designer has moved past look unfinished. A step that is itself
    // complete always reads as done, even when it's the furthest one reached.
    let state: StepState;
    if (index < reachedIndex || complete[s.key]) state = 'done';
    else if (index === reachedIndex) state = 'current';
    else state = 'upcoming';
    // A completed step has nothing open. One the designer moved past without
    // finishing carries its count, so the marker can say "4 left".
    const open = complete[s.key] ? 0 : remaining[s.key] ?? 0;
    return {
      key: s.key,
      label: s.label,
      state,
      index,
      count: counts[s.key],
      remaining: open > 0 ? open : undefined,
      active: index === currentIndex,
      locked: !navigable(index),
    };
  });

  // Switch the interview step's copy to the "continue" variant only when that
  // step is the one currently surfaced. Keyed off the action (not a hardcoded
  // step key) so it stays correct across tracker types.
  const currentStepKey = steps[currentIndex]?.key;
  const currentCopyOverride =
    interviewInProgress && currentStepKey && def.copy[currentStepKey]?.action === 'interview'
      ? STORY_IN_PROGRESS_COPY
      : undefined;

  return {
    type: input.type,
    label: def.label,
    steps,
    currentIndex,
    frontierIndex,
    reachedIndex,
    materialsIndex,
    materialsExist,
    endCap: def.endCap,
    currentCopyOverride,
  };
}
