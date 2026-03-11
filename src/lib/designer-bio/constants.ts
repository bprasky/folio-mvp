/**
 * Bio Interview & Profile Q&A constants
 */

// Bio status progression
export const BIO_STATUSES = ['empty', 'scraped', 'interviewing', 'generated', 'published'] as const;
export type BioStatus = (typeof BIO_STATUSES)[number];

// Q&A statuses
export const QA_STATUSES = ['pending', 'answered', 'skipped', 'hidden'] as const;
export type QAStatus = (typeof QA_STATUSES)[number];

// Q&A categories
export const QA_CATEGORIES = ['personality', 'preference', 'conviction', 'project', 'milestone', 'vendor', 'evolution'] as const;
export type QACategory = (typeof QA_CATEGORIES)[number];

// Q&A sources
export const QA_SOURCES = ['initial_seed', 'bio_context', 'project_trigger', 'vendor_trigger', 'milestone_trigger'] as const;
export type QASource = (typeof QA_SOURCES)[number];

// Q&A generation limits
export const QA_MAX_PENDING = 5;
export const QA_MIN_GAP_DAYS = 7;
export const QA_INITIAL_SEED_COUNT = { min: 3, max: 5 };

// Bio generation minimum answers
export const BIO_MIN_ANSWERS = 3;

// Interview answer shape (stored as JSON)
export type InterviewAnswer = {
  id: string;
  question: string;
  answer: string;
  round: 'base' | 'followup';
};
