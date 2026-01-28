/**
 * Contributor/Voice System - Type Definitions
 * See: prisma/schema.prisma for source of truth
 */

// Re-export Prisma enums for use in application code
export type ArticleTopicStatus =
  | 'QUEUED'
  | 'GATHERING'
  | 'THRESHOLD_MET'
  | 'WRITING'
  | 'REVIEW'
  | 'PUBLISHED'
  | 'ARCHIVED';

export type ContributionType =
  | 'QUICK_TAKE'
  | 'EXPERTISE'
  | 'PREDICTION'
  | 'REFLECTION'
  | 'ENDORSEMENT'
  | 'CONSUMER_VOICE';

export type ContributionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'SELECTED'
  | 'PUBLISHED'
  | 'REJECTED';

export type BadgeLevel =
  | 'VOICE'
  | 'PERSPECTIVE'
  | 'SPECIALIST'
  | 'ENGAGED'
  | 'AUTHORITY'
  | 'EDITORIAL_VOICE';

export type PromptLocation =
  | 'MAGAZINE_PAGE'
  | 'FOR_YOU_FEED'
  | 'POST_SAVE'
  | 'POST_PUBLISH'
  | 'WELCOME_BACK'
  | 'PRODUCT_PAGE'
  | 'PROJECT_DETAIL'
  | 'PROFILE_DASHBOARD';

// Category types for article topics
export type ArticleCategory =
  | 'material'
  | 'trend'
  | 'philosophy'
  | 'vendor'
  | 'regional';

// Role types for targeting
export type TargetRole = 'DESIGNER' | 'VENDOR' | 'INDIVIDUAL';

/**
 * Article topic with contribution stats
 */
export interface ArticleTopicWithStats {
  id: string;
  title: string;
  slug: string;
  promptQuestion: string;
  description: string | null;
  category: string;
  tags: string[];
  targetRoles: string[];
  targetMaterials: string[];
  targetStyles: string[];
  minSaveCount: number | null;
  minContributions: number;
  targetContributions: number;
  minDesigners: number;
  minReps: number | null;
  minIndividuals: number | null;
  status: ArticleTopicStatus;
  autoTriggered: boolean;
  queuedAt: Date;
  gatheringStartedAt: Date | null;
  targetPublishDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Stats
  contributionCount: number;
  designerCount: number;
  vendorCount: number;
  individualCount: number;
  // User's contribution if exists
  userContribution?: ContributionSummary | null;
}

/**
 * Summary of a contribution
 */
export interface ContributionSummary {
  id: string;
  userId: string;
  userRole: string;
  type: ContributionType;
  content: string;
  status: ContributionStatus;
  createdAt: Date;
}

/**
 * Full contribution with relations
 */
export interface ContributionWithRelations {
  id: string;
  userId: string;
  userRole: string;
  articleTopicId: string;
  productId: string | null;
  projectId: string | null;
  saveId: string | null;
  type: ContributionType;
  content: string;
  audioUrl: string | null;
  voiceTranscript: string | null;
  status: ContributionStatus;
  editedContent: string | null;
  pullQuote: string | null;
  publishedInPostId: string | null;
  displayOrder: number | null;
  shareCardUrl: string | null;
  shareCardGeneratedAt: Date | null;
  shareCount: number;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  user: {
    id: string;
    name: string;
    profileImage: string | null;
    role: string;
  };
  articleTopic: {
    id: string;
    title: string;
    slug: string;
    promptQuestion: string;
  };
  product?: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
  project?: {
    id: string;
    title: string;
  } | null;
}

/**
 * Contributor profile with badges and stats
 */
export interface ContributorProfile {
  userId: string;
  badges: {
    level: BadgeLevel;
    earnedAt: Date;
    publishedCount: number;
    totalContributions: number;
  }[];
  contributionCount: number;
  publishedContributionCount: number;
  contributorLevel: BadgeLevel | null;
  contributions: ContributionSummary[];
}

/**
 * Prompt with topic information
 */
export interface PromptWithTopic {
  id: string;
  location: PromptLocation;
  targetRoles: string[];
  targetMaterials: string[];
  targetStyles: string[];
  minSaveCount: number | null;
  minDaysActive: number | null;
  customQuestion: string | null;
  priority: number;
  active: boolean;
  createdAt: Date;
  articleTopic: {
    id: string;
    title: string;
    slug: string;
    promptQuestion: string;
    status: ArticleTopicStatus;
    contributionCount: number;
  };
}

/**
 * Input for submitting a contribution
 */
export interface SubmitContributionInput {
  userId: string;
  articleTopicId: string;
  content: string;
  type: ContributionType;
  audioUrl?: string;
  voiceTranscript?: string;
  productId?: string;
  projectId?: string;
  saveId?: string;
}

/**
 * Result of submitting a contribution
 */
export interface SubmitContributionResult {
  success: boolean;
  contribution?: ContributionWithRelations;
  error?: string;
  thresholdMet?: boolean;
}

/**
 * Badge thresholds configuration
 */
export const BADGE_THRESHOLDS = {
  VOICE: 1,
  PERSPECTIVE: 5,
  SPECIALIST: 5,
  ENGAGED: 5,
  AUTHORITY: 15,
  EDITORIAL_VOICE: 30,
} as const;

/**
 * Map role to badge level at 5 publications
 */
export const ROLE_TO_BADGE_5: Record<string, BadgeLevel> = {
  DESIGNER: 'PERSPECTIVE',
  VENDOR: 'SPECIALIST',
  INDIVIDUAL: 'ENGAGED',
  ARCHITECT: 'PERSPECTIVE',
  BUILDER: 'PERSPECTIVE',
};

/**
 * Get display name for contribution type
 */
export function getContributionTypeLabel(type: ContributionType): string {
  const labels: Record<ContributionType, string> = {
    QUICK_TAKE: 'Quick Take',
    EXPERTISE: 'Product Expertise',
    PREDICTION: 'Trend Prediction',
    REFLECTION: 'Project Reflection',
    ENDORSEMENT: 'Product Endorsement',
    CONSUMER_VOICE: 'Consumer Perspective',
  };
  return labels[type] || type;
}

/**
 * Get display name for badge level
 */
export function getBadgeLevelLabel(level: BadgeLevel): string {
  const labels: Record<BadgeLevel, string> = {
    VOICE: 'Voice',
    PERSPECTIVE: 'Design Perspective',
    SPECIALIST: 'Product Specialist',
    ENGAGED: 'Engaged Reader',
    AUTHORITY: 'Industry Authority',
    EDITORIAL_VOICE: 'Editorial Voice',
  };
  return labels[level] || level;
}

/**
 * Get display name for article topic status
 */
export function getTopicStatusLabel(status: ArticleTopicStatus): string {
  const labels: Record<ArticleTopicStatus, string> = {
    QUEUED: 'Queued',
    GATHERING: 'Gathering Voices',
    THRESHOLD_MET: 'Ready for Writing',
    WRITING: 'In Writing',
    REVIEW: 'Under Review',
    PUBLISHED: 'Published',
    ARCHIVED: 'Archived',
  };
  return labels[status] || status;
}
