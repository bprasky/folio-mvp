// Editorial Queue — corpus digest types (docs/17_EDITORIAL_QUEUE.md, Component 1).
//
// Division of labor is fixed: code computes the facts (this module), the model
// picks the story (angle extraction, Component 2). Signals carry stable IDs and
// row-level evidence so DesignerAngle.evidence always resolves to verifiable
// rows — the validation-reject rule checks cited signal IDs against a digest.

export type SignalType =
  | 'repetition'
  | 'distribution'
  | 'claim_evidence'
  | 'outlier'
  | 'save_delta'
  | 'evolution';

// Row-level references backing a signal. Every ID resolves to a real row so
// angles citing this signal can be verified before persistence.
export interface SignalEvidence {
  projectIds?: string[];
  imageIds?: string[];
  productIds?: string[];
  productTagIds?: string[];
  interviewAnswerIds?: string[];
  // Non-row facts backing the signal (finish family, category shares, bio terms).
  facts?: Record<string, string | number | string[]>;
}

export interface ComputedSignal {
  // Stable, content-derived ID (e.g. 'rep:finish:brass'). Same corpus in,
  // same IDs out — extraction cites these and validation resolves them.
  id: string;
  type: SignalType;
  // One-line statement of the computed fact, written for the extraction prompt.
  headline: string;
  detail: string;
  // 0..1 heuristic weight so extraction can rank without re-deriving.
  strength: number;
  evidence: SignalEvidence;
}

// ─── Raw layer ────────────────────────────────────────────────────────────────

export interface DigestDesigner {
  id: string;
  name: string;
  bio: string | null;
  studio: string | null;
  title: string | null;
  location: string | null;
  specialties: string[];
}

export interface DigestProduct {
  productId: string;
  name: string;
  category: string | null;
  brand: string | null;
  colorFinish: string | null;
  // Normalized material class (see MATERIAL_CLASSES) — 'unlacquered brass' and
  // 'brushed brass' both land in 'brass' so repetition can see across variants.
  finishFamily: string | null;
  vendorId: string | null;
  // Provenance travels with the product so downstream distribution can apply
  // the ImageSource gate (only DESIGNER_ORIGINAL / FOLIO_COMMISSIONED ship).
  imageSource: string;
}

export interface DigestTag {
  tagId: string;
  productId: string;
  imageId: string;
  projectId: string;
}

export interface DigestImage {
  imageId: string;
  projectId: string;
  roomName: string | null;
  roomType: string | null;
  tagCount: number;
  // Product-level saves joined through this image's tags (the save-delta
  // derivation — no image-level save table exists).
  derivedSaveCount: number;
}

export interface DigestProject {
  projectId: string;
  title: string;
  category: string | null;
  budgetBand: string;
  stage: string;
  city: string | null;
  regionState: string | null;
  createdAt: string; // ISO
  publishedAt: string | null; // ISO — ProjectPost.publishedAt (story order)
  postVariant: string | null;
  roomTypes: string[];
  tagCount: number;
  saveCount: number; // denormalized Project.saves
}

export interface DigestInterviewAnswer {
  answerId: string;
  projectId: string;
  questionText: string | null;
  answerText: string;
  questionSource: string | null;
  roomName: string | null;
  isFollowUp: boolean;
}

export interface DigestQueuePiece {
  queueItemId: string;
  angleType: string;
  format: string;
  status: string;
  completedAt: string | null; // ISO
}

export interface RawCorpusLayer {
  designer: DigestDesigner;
  projects: DigestProject[];
  images: DigestImage[];
  tags: DigestTag[];
  products: DigestProduct[];
  interviewAnswers: DigestInterviewAnswer[];
  // Feedback loop: prior completed/scheduled/published queue pieces so
  // extraction can judge angle freshness.
  priorQueuePieces: DigestQueuePiece[];
  // productId -> Save count across the platform. Empty map = no engagement data.
  productSaves: Record<string, number>;
}

// ─── Maturity ladder ─────────────────────────────────────────────────────────

export interface CorpusMaturity {
  publishedStoryCount: number;
  tagCount: number;
  hasEngagementData: boolean;
  eligibleSignalTypes: SignalType[];
}

// ─── Digest ──────────────────────────────────────────────────────────────────

export interface CorpusDigest {
  designerId: string;
  maturity: CorpusMaturity;
  raw: RawCorpusLayer;
  signals: ComputedSignal[];
}

// ─── Angle extraction (Component 2) ──────────────────────────────────────────

// The seven angle types the model may assign, per docs/17_EDITORIAL_QUEUE.md.
// Stored verbatim on DesignerAngle.angleType.
export const ANGLE_TYPES = [
  'material_loyalty',
  'evolution',
  'anatomy_of_room',
  'process',
  'philosophy',
  'client_dynamic',
  'regional_identity',
] as const;

export type AngleType = typeof ANGLE_TYPES[number];

// Raw shape the model returns, before validation. Citations are unverified here.
export interface CandidateAngle {
  angleType: string;
  summary: string;
  signalIds: string[];
  confidence: number;
}

// A candidate that passed the validation-reject rule: every cited signal ID
// resolves to a signal in the digest, and evidence is the union of those
// signals' row-level evidence. This is what persists as a DesignerAngle.
export interface ExtractedAngle {
  angleType: AngleType;
  summary: string;
  signalIds: string[];
  confidence: number;
  evidence: SignalEvidence;
  isFresh: boolean;
}

// Outcome of a rejected candidate, kept for observability (why did the guard
// fire) rather than silently dropped.
export interface RejectedAngle {
  candidate: CandidateAngle;
  reason: 'no_valid_citation' | 'fabricated_citation' | 'unknown_angle_type' | 'empty_summary';
  fabricatedIds?: string[];
}

export interface AngleValidationResult {
  accepted: ExtractedAngle[];
  rejected: RejectedAngle[];
}

// ─── Prompt generation (Component 3) ─────────────────────────────────────────

// One designer-facing prompt. `hint` is the private "what we're listening for"
// note shown as guidance; `optionA`/`optionB` are populated only for
// THIS_OR_THAT items.
export interface QueuePromptItem {
  id: string;
  prompt: string;
  hint?: string;
  optionA?: string;
  optionB?: string;
}

// The generated prompt structure stored on EditorialQueueItem.prompts (Json),
// not rendered at read time. `format` is the assigned PostVariant/QueueFormat
// value (string here to avoid a module cycle with assignFormat).
export interface PromptStructure {
  format: string;
  intro: string;
  items: QueuePromptItem[];
}
