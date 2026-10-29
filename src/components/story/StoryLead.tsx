'use client';

// Shared headline, deck and introduction slots. The collapsed cover uses a
// read-only teaser; its expanded introduction keeps the studio's inline editing.
// Every publication surface imports these slots so editing cannot drift between
// image orientations or page variants.

import type { CSSProperties } from 'react';
import type { StoryData } from '@/lib/story/buildRoomTiles';
import { useStoryEdit, StoryEditRegion } from './StoryEditContext';
import { HeadlinePicker } from './HeadlinePicker';
import EditableParagraph from '@/components/posting/editing/EditableParagraph';
import { capitalizeOpening } from '@/lib/story/roomSlides';

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
export function LeadHeadline({ story, className, style, as = 'h1', readOnly = false }: SlotProps & { as?: 'h1' | 'h2'; readOnly?: boolean }) {
  const edit = useStoryEdit();
  const Tag = as;

  if (!edit || readOnly) {
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
    return story.subtitle ? <p className={className} style={style}>{capitalizeOpening(story.subtitle)}</p> : null;
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
    // The builder uses the deck as a fallback when there is no introduction.
    // It already has its own slot, so do not print that fallback a second time.
    const paragraphs = story.introParagraphs.length ? story.introParagraphs
      : story.introText && story.introText !== story.subtitle ? [story.introText] : [];
    return <>{paragraphs.map((paragraph, index) =>
      <p key={index} className={className} style={style}>{index === 0 ? capitalizeOpening(paragraph) : paragraph}</p>)}</>;
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

/** A non-editing teaser; the expanded introduction owns all editing controls. */
export function LeadPreview({ story, className }: SlotProps) {
  return <span className={className}>{capitalizeOpening(story.subtitle || story.introText || '')}</span>;
}
