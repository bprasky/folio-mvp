/**
 * Types for article section editing (Phase C).
 * Overrides store manual edits separately from AI-generated expandedBlocks.
 */

export type SectionOverrideField = 'title' | 'body' | 'pullQuote' | 'kicker' | 'deck' | 'introduction';

export type SectionOverride = {
  /** Chapter index in galleryChapters. -1 for lead fields (kicker, deck). -2 for introduction paragraphs. */
  chapterIndex: number;
  /** For body fields: paragraph index within body[]. For other fields: 0. */
  paragraphIndex: number;
  /** Which field was edited. */
  field: SectionOverrideField;
  /** Original AI-generated text. */
  originalBody: string;
  /** Designer's edited text. */
  editedBody: string;
  /** ISO datetime of the edit. */
  editedAt: string;
};

export type SectionVersion = {
  body: string[];
  feedback?: string;
  createdAt: string;
};

export type SectionHistoryEntry = {
  chapterIndex: number;
  versions: SectionVersion[];
};
