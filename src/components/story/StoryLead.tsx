'use client';

// ============================================================================
// The lead — headline, deck, introduction — as three components, once.
//
// These were written twice: StoryIntro rendered them for the portrait hero, and
// LandscapeHero rendered its own copies inline. Making the lead editable meant
// editing StoryIntro, which made the fields editable on portrait articles and
// left every landscape article — the common case — with a plain <h1> and no
// controls at all. The rooms worked, the top of the article did not, and nothing
// failed: the second copy just kept rendering read-only markup.
//
// So the editability is not the point of this file. ONE implementation is. A
// third hero variant can only get the lead by importing these, and the check in
// scripts/check-story-editing.ts fails if anything renders `story.title`,
// `story.subtitle` or the introduction outside this module.
//
// Every component here renders exactly what it rendered before when no edit
// context is mounted, so the published article at /p/[slug] is unchanged.
// ============================================================================

import type { CSSProperties } from 'react';
import type { StoryData } from '@/lib/story/buildRoomTiles';
import { useStoryEdit, StoryEditRegion } from './StoryEditContext';
import { HeadlinePicker } from './HeadlinePicker';
import EditableParagraph from '@/components/posting/editing/EditableParagraph';

/** Sentinel chapter indices the section-override API uses for lead fields. */
const LEAD = -1;
const INTRODUCTION = -2;

interface SlotProps {
  story: StoryData;
  className?: string;
  style?: CSSProperties;
}

/**
 * The headline, plus the option picker when the designer owns the draft.
 *
 * `as` exists because the two heroes disagree about heading level: the landscape
 * hero's title is the page's h1, while the portrait layout renders it beside the
 * photo. The editable path always renders h2 — EditableParagraph's contract —
 * which is why the read-only path keeps whichever tag it was given.
 */
export function LeadHeadline({ story, className, style, as = 'h1' }: SlotProps & { as?: 'h1' | 'h2' }) {
  const edit = useStoryEdit();
  const Tag = as;

  if (!edit) {
    return <Tag className={className} style={style}>{story.title}</Tag>;
  }

  return (
    <StoryEditRegion>
      <EditableParagraph
        text={story.title}
        isEdited={edit.isEdited(LEAD, 0, 'kicker')}
        isEditing={edit.isEditing(LEAD, 0, 'kicker')}
        placeholder="Article headline..."
        as="h2"
        className={className}
        onStartEdit={() => edit.openEditor(LEAD, 0, 'kicker')}
        onSave={(t) => edit.save(LEAD, 0, 'kicker', t)}
        onCancel={() => edit.closeEditor()}
        onRevert={() => edit.revert(LEAD, 0, 'kicker')}
      />
      <HeadlinePicker current={story.title} alternatives={story.titleAlternatives} />
    </StoryEditRegion>
  );
}

/**
 * The deck: the line under the headline that sets up the story.
 *
 * Generated on every article and, until it got this slot, displayed nowhere.
 */
export function LeadDeck({ story, className, style }: SlotProps) {
  const edit = useStoryEdit();

  if (!edit) {
    return story.subtitle ? <p className={className} style={style}>{story.subtitle}</p> : null;
  }

  return (
    <StoryEditRegion>
      <EditableParagraph
        text={story.subtitle ?? ''}
        isEdited={edit.isEdited(LEAD, 0, 'deck')}
        isEditing={edit.isEditing(LEAD, 0, 'deck')}
        placeholder="A line or two setting up the story..."
        className={className}
        onStartEdit={() => edit.openEditor(LEAD, 0, 'deck')}
        onSave={(t) => edit.save(LEAD, 0, 'deck', t)}
        onCancel={() => edit.closeEditor()}
        onRevert={() => edit.revert(LEAD, 0, 'deck')}
      />
    </StoryEditRegion>
  );
}

/**
 * The introduction.
 *
 * Read-only it is one string, because that is what a reader wants and what
 * `introText` has always been. Editing addresses the paragraphs individually,
 * because the override API is keyed by paragraph index — the same split the
 * room narratives needed.
 */
export function LeadIntro({ story, className, style }: SlotProps) {
  const edit = useStoryEdit();

  if (!edit) {
    return story.introText ? (
      <p className={className} style={style}>{story.introText}</p>
    ) : null;
  }

  if (story.introParagraphs.length === 0) return null;

  return (
    <StoryEditRegion className="flex flex-col gap-3">
      {story.introParagraphs.map((para, pi) => (
        <EditableParagraph
          key={pi}
          text={para}
          isEdited={edit.isEdited(INTRODUCTION, pi, 'introduction')}
          isEditing={edit.isEditing(INTRODUCTION, pi, 'introduction')}
          placeholder="Introduction paragraph..."
          className={className}
          onStartEdit={() => edit.openEditor(INTRODUCTION, pi, 'introduction')}
          onSave={(t) => edit.save(INTRODUCTION, pi, 'introduction', t)}
          onCancel={() => edit.closeEditor()}
          onRevert={() => edit.revert(INTRODUCTION, pi, 'introduction')}
        />
      ))}
    </StoryEditRegion>
  );
}
