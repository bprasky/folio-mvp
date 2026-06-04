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

export interface TrackerStep {
  key: string;
  label: string;
  state: StepState;
  index: number;
  /** Secondary count shown under done steps. Omitted where no number applies. */
  count?: number;
}

export interface TrackerInput {
  type: TrackerType;
  /** Completion flag per step key. */
  complete: Record<string, boolean>;
  /** Secondary count per step key (optional). */
  counts?: Record<string, number | undefined>;
  /** True once any product/material has been added to the project. */
  materialsExist: boolean;
}

export interface TrackerState {
  type: TrackerType;
  label: string;
  steps: TrackerStep[];
  currentIndex: number;
  /** Index of the materials/import step within `steps`. */
  materialsIndex: number;
  materialsExist: boolean;
  endCap?: string;
}

/**
 * Derive the live tracker state. `currentIndex` is the first incomplete step;
 * if every step is complete it pins to the last step (the publish/share/final
 * action stays the prominent CTA).
 */
export function deriveTrackerState(input: TrackerInput): TrackerState {
  const def = TRACKER_TYPES[input.type];
  const { complete, counts = {}, materialsExist } = input;

  const firstIncomplete = def.steps.findIndex(s => !complete[s.key]);
  const currentIndex = firstIncomplete === -1 ? def.steps.length - 1 : firstIncomplete;
  const materialsIndex = def.steps.findIndex(s => s.key === def.materialsKey);

  const steps: TrackerStep[] = def.steps.map((s, index) => {
    let state: StepState;
    if (index < currentIndex) state = 'done';
    else if (index === currentIndex) state = 'current';
    else state = 'upcoming';
    return { key: s.key, label: s.label, state, index, count: counts[s.key] };
  });

  return {
    type: input.type,
    label: def.label,
    steps,
    currentIndex,
    materialsIndex,
    materialsExist,
    endCap: def.endCap,
  };
}
