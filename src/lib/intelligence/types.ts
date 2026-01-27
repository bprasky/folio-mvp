/**
 * Intelligence System Types
 * See docs/12_INTELLIGENCE_SYSTEM.md for full specification
 */

// Product attributes extracted for signals
export interface ProductAttributes {
  colors: string[];
  materials: string[];
  shapes: string[];
  styles: string[];
  category?: string;
}

// Signal types with weights
export type SignalType = 'view' | 'like' | 'save' | 'tag';

export const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  view: 0.1,
  like: 1.0,
  save: 2.0,
  tag: 3.0,
};

// Taste inference from pattern detection
export interface TasteInferenceData {
  attribute: string;
  attributeType: 'color' | 'material' | 'shape' | 'style';
  confidence: number;
  evidence: string;
  source: 'frequency' | 'cross_pattern' | 'clustering';
}

// Pattern detection results
export interface PatternDetectionResult {
  inferences: TasteInferenceData[];
  signalCount: number;
  lastUpdated: Date;
}

// Style signature from clustering
export interface StyleSignature {
  dominantStyle: string | null;
  confidence: number;
  matchingItems: number;
}

// Designer match result
export interface DesignerMatch {
  designerId: string;
  designerName: string;
  matchScore: number;
  matchPercentage: number;
  sharedAttributes: string[];
}

// Confirmation response
export type ConfirmationResponse = 'confirm' | 'deny' | 'skip';

// User taste profile summary
export interface TasteProfileSummary {
  userId: string;
  styleName: string | null;
  styleDescription: string | null;
  confirmedAttributes: string[];
  totalLikes: number;
  totalSaves: number;
  profileStrength: number;
  topInferences: TasteInferenceData[];
  designerMatches: DesignerMatch[];
}

// Engagement milestones for progressive disclosure
export const ENGAGEMENT_MILESTONES = {
  FIRST_HINT: 5,       // "Keep saving! We're learning your taste."
  FIRST_INSIGHT: 10,   // First pattern inference
  CROSS_PATTERN: 15,   // Cross-pattern insight
  STYLE_NAME: 25,      // Style name generation
} as const;

// Board types
export type BoardType = 'room' | 'style' | 'inspiration' | 'auto';

// Room types for boards and saves
export const ROOM_TYPES = [
  'living_room',
  'bedroom',
  'kitchen',
  'bathroom',
  'dining_room',
  'office',
  'entryway',
  'outdoor',
  'nursery',
  'guest_room',
] as const;

export type RoomType = typeof ROOM_TYPES[number];
