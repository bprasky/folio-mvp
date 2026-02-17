export type SessionState =
  | 'initializing'
  | 'greeting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'paused'
  | 'closing'
  | 'ended';

export interface ProjectImage {
  id: string;
  url: string;
  roomName: string | null;
  aiClassification: {
    style?: string;
    mood?: string;
    materials?: string[];
    colors?: string[];
  } | null;
}

export interface ProductTag {
  id: string;
  productName: string;
  vendorName: string | null;
  category: string | null;
  roomName: string | null;
}

export interface ConversationExchange {
  role: 'designer' | 'ai';
  content: string;
  timestamp: number;
  extractions?: {
    pullQuote?: string;
    productMentions?: Array<{ name: string; context: string; sentiment: string }>;
    theme?: string;
    mood?: string;
    roomFocus?: string;
  };
}

/** Cached interview brief from the main app (stored in ProjectPost.provenance) */
export interface CachedInterviewBrief {
  visualNotes: string;
  researchNotes: string[];
  suggestedAngles: string[];
  vendorMap: Array<{
    name: string;
    count: number;
    rooms: string[];
    heroProducts: string[];
  }>;
  designerContext?: {
    name: string;
    statedApproach: string | null;
    priorProjectCount: number;
    priorInterviewCount: number;
  } | null;
}

export interface ConversationContext {
  // Static context (loaded once)
  projectId: string;
  projectName: string;
  designerName: string;
  designerBio: string | null;
  images: ProjectImage[];
  products: ProductTag[];
  rooms: string[];

  /** Pre-interview intelligence brief (loaded from ProjectPost.provenance if available) */
  interviewBrief: CachedInterviewBrief | null;

  // Rolling context (updated each turn)
  summary: string;
  turnCount: number;
  extractedQuotes: string[];
  extractedProducts: Array<{ name: string; context: string }>;
  extractedThemes: string[];

  /** Suggested angles from the brief that have been explored */
  coveredAngles: string[];

  // Recent exchanges (last 5, full text)
  recentExchanges: ConversationExchange[];
}

export interface SofiaResponse {
  reply: string;
  extractions: {
    pullQuote: string | null;
    productMentions: Array<{ name: string; context: string; sentiment: string }>;
    theme: string | null;
    mood: string | null;
    roomFocus: string | null;
  };
  nextQuestionIntent: string;
  shouldContinue: boolean;
}

export interface SessionConfig {
  sessionId: string;
  projectId: string;
  roomName: string;
}

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

export interface SegmentData {
  role: 'designer' | 'ai';
  content: string;
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  transcriptConfidence?: number;
  transcriptRaw?: string;
  promptTokens?: number;
  responseTokens?: number;
  latencyMs?: number;
  extractedQuote?: string;
  extractedProducts?: string[];
  extractedMood?: string;
  linkedRoomName?: string;
}

export interface PrepareSessionRequest {
  sessionId: string;
  projectId: string;
  roomName: string;
}

export interface DataMessage {
  type:
    | 'state_change'
    | 'transcript'
    | 'segment'
    | 'extraction'
    | 'complete'
    | 'error'
    | 'pause'
    | 'resume'
    | 'end';
  state?: SessionState;
  text?: string;
  segment?: {
    id: string;
    role: 'designer' | 'ai';
    content: string;
    timestamp: number;
    extractedQuote?: string;
  };
  extraction?: {
    pullQuote?: string;
    productMentions?: string[];
    theme?: string;
    mood?: string;
  };
  error?: string;
}
