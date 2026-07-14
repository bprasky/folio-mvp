// Editorial Queue — format assignment (docs/17_EDITORIAL_QUEUE.md, Component 3).
// Format is assigned AFTER the angle, as the container. It extends the existing
// PostVariant enum so completed queue pieces flow through the existing
// ProjectPost publishing path with no bridge code.
//
// Pure and deterministic: angle type in, PostVariant out. The maturity ladder
// already gated which angle types can appear at a given corpus depth, so the
// mapping itself is static per angle type — the container follows the story.

import type { AngleType } from './types';

// PostVariant values the queue assigns. QA / THIS_OR_THAT / GET_TO_KNOW were
// added by the Editorial Queue enum migration; the rest are existing values the
// spec marks assignable. PROJECT_FEATURE and EVENT_ESSAY are intentionally not
// used here — they need project/event scope a corpus-derived piece doesn't have.
export type QueueFormat =
  | 'QA'
  | 'THIS_OR_THAT'
  | 'GET_TO_KNOW'
  | 'MATERIAL_STUDY'
  | 'METHOD'
  | 'DESIGNER_PROFILE';

// The container each angle type earns. One line of intent per row so the mapping
// reads as editorial decisions, not a lookup table.
const FORMAT_BY_ANGLE: Record<AngleType, QueueFormat> = {
  // A repeated material is a study of that material.
  material_loyalty: 'MATERIAL_STUDY',
  // A directional shift over time is a method/evolution piece.
  evolution: 'METHOD',
  // The standout room is a walk-through Q&A.
  anatomy_of_room: 'QA',
  // How-they-work is a method piece.
  process: 'METHOD',
  // Positioning and belief is a get-to-know.
  philosophy: 'GET_TO_KNOW',
  // The client relationship is a Q&A.
  client_dynamic: 'QA',
  // Place and identity is a profile.
  regional_identity: 'DESIGNER_PROFILE',
};

// At the minimum corpus (first pieces), bias toward the lightest containers so
// the designer is trained on quick wins before heavier formats. Only the
// heavier containers are softened; Q&A and get-to-know already read as light.
const MIN_CORPUS_STORIES = 5;

export function assignFormat(
  angleType: AngleType,
  publishedStoryCount: number,
): QueueFormat {
  const base = FORMAT_BY_ANGLE[angleType];
  if (publishedStoryCount < MIN_CORPUS_STORIES) {
    // MATERIAL_STUDY and DESIGNER_PROFILE are the heavier lifts; at minimum
    // corpus, offer them as a lighter container built on the same angle.
    if (base === 'MATERIAL_STUDY') return 'THIS_OR_THAT';
    if (base === 'DESIGNER_PROFILE') return 'GET_TO_KNOW';
  }
  return base;
}
