/**
 * Contextual Interview System
 *
 * A system for generating interview questions that scale with available project context.
 * The more we know about the project, the smarter and more specific our questions become.
 *
 * @example
 * ```typescript
 * import {
 *   assessProjectContext,
 *   generateInterviewQuestions,
 *   analyzeAnswer
 * } from '@/lib/interview';
 *
 * // Assess project context
 * const context = await assessProjectContext(projectId);
 *
 * // Generate questions based on context level
 * const questions = await generateInterviewQuestions(context, {
 *   maxQuestions: 10,
 *   prioritizeBoostable: true
 * });
 *
 * // Later, analyze answers for boost eligibility
 * const analysis = await analyzeAnswer(question, answer);
 * if (analysis.boost_eligible) {
 *   // This answer can be boosted by vendors
 * }
 * ```
 */

// Context Level Assessment
export {
  assessProjectContext,
  getContextLevelDescription,
  getContextUpgradeSuggestion,
  classifyProjectSize,
} from './contextLevel';

export type {
  ContextLevel,
  ProjectContext,
  ProjectSize,
  ProjectSizeClassification,
  RoomContext,
  RoomType,
  SelectionContext,
  VendorInsight,
  DecisionEvent,
  SpatialRelationship,
  AspirationalItem,
  AmbiencePattern,
} from './contextLevel';

// Question Generation
export {
  generateInterviewQuestions,
  toInterviewQuestion,
} from './generateQuestions';

export type {
  GeneratedQuestion,
  QuestionType,
  GenerateQuestionsOptions,
} from './generateQuestions';

// Spatial Flow Analysis
export {
  analyzeFloorPlan,
  extractSpatialRelationships,
  buildRoomAdjacencies,
  generateFlowNarrative,
} from './spatialFlow';

export type {
  FloorPlanAnalysis,
  DetectedRoom,
  RoomConnection,
  FlowSequence,
} from './spatialFlow';

// Narrative Generation
export {
  generateSpatialNarrative,
  generateDesignNarrative,
  generateRoomIntroductions,
  generateMaterialStories,
} from './narrativeGeneration';

export type {
  NarrativeSegment,
} from './narrativeGeneration';

// Answer Analysis
export {
  analyzeAnswer,
  analyzeAnswers,
  generateBoostSummary,
  isVendorHighlightWorthy,
  analyzeAndProcessAnswer,
} from './answerAnalysis';

export type {
  AnswerAnalysis,
  VendorSentiment,
  Sentiment,
} from './answerAnalysis';

// Answer Digestion (heuristic scoring)
export {
  digestInterviewAnswer,
  buildDigestContext,
} from './digestInterviewAnswer';

export type {
  AnswerDigest,
  VendorSentimentSignal,
  DigestContext,
} from './digestInterviewAnswer';

// Pre-Interview Intelligence Brief
export {
  buildInterviewBrief,
  formatBriefAsNarrative,
} from './buildInterviewBrief';

export type {
  InterviewBrief,
  VendorBriefEntry,
  HeroSelectionEntry,
  DesignerBriefContext,
} from './buildInterviewBrief';
