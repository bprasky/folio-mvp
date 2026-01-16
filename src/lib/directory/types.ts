/**
 * Directory System Types
 * Merit-based ranking and discovery layer for designers and vendors
 */

export type RankingType = 'DESIGNER' | 'VENDOR';
export type SubscriptionTier = 'FREE' | 'PRO' | 'STUDIO' | 'ENTERPRISE';

export interface DesignerScoreComponents {
  taggedProjectsScore: number;      // 35% - fully tagged projects
  completenessScore: number;        // 20% - project completeness
  engagementScore: number;          // 15% - saves, views, followers, shares
  editorialScore: number;           // 15% - editorial contributions
  vendorDiversityScore: number;     // 10% - unique vendors tagged
  recencyScore: number;             // 5% - recent activity boost
}

export interface VendorScoreComponents {
  designerTagsScore: number;        // 40% - how many designers tag their products
  projectInclusionScore: number;    // 25% - products appearing in projects
  saveScore: number;                // 20% - saves on projects featuring their products
  catalogCompletenessScore: number; // 15% - SKU coverage, CAD files, etc.
}

export interface DesignerRankingScore {
  userId: string;
  components: DesignerScoreComponents;
  totalScore: number;
  rank: number | null;
  previousRank: number | null;
  rankChange: number;
  isEligible: boolean;
  lastCalculatedAt: Date;
}

export interface VendorRankingScore {
  vendorOrgId: string;
  components: VendorScoreComponents;
  totalScore: number;
  rank: number | null;
  previousRank: number | null;
  rankChange: number;
  isEligible: boolean;
  lastCalculatedAt: Date;
}

export interface DirectoryDesigner {
  rank: number;
  rankChange: number;
  user: {
    id: string;
    name: string;
    profileImage: string | null;
    location: string | null;
    title: string | null;
    bio: string | null;
  };
  stats: {
    projectCount: number;
    totalSaves: number;
    followerCount: number;
  };
  featuredProject?: {
    id: string;
    title: string;
    heroImage: string | null;
  };
}

export interface DirectoryVendor {
  rank: number;
  rankChange: number;
  organization: {
    id: string;
    name: string;
    logo: string | null;
    description: string | null;
    type: string;
  };
  stats: {
    designersTagging: number;
    projectsIncluded: number;
    totalProductSaves: number;
    catalogSize: number;
  };
}

export interface DirectoryListParams {
  page?: number;
  limit?: number;
  style?: string;
  region?: string;
  view?: 'overall' | 'rising';
}

export interface DirectoryListResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  lastUpdated: Date;
}

export interface RankingSuggestion {
  type: 'tag_products' | 'complete_project' | 'publish_more' | 'upgrade_pro';
  message: string;
  potentialScoreGain: number;
  actionUrl?: string;
}

export interface DesignerRankingResponse {
  rank: number | null;
  rankChange: number;
  totalScore: number;
  isEligible: boolean;
  requiresProUpgrade: boolean;
  breakdown?: DesignerScoreComponents;
  suggestions?: RankingSuggestion[];
}

// Score update triggers
export type ScoreUpdateTrigger =
  | 'project_published'
  | 'product_tagged'
  | 'project_saved'
  | 'project_viewed'
  | 'follower_gained'
  | 'editorial_achieved'
  | 'subscription_changed'
  | 'profile_updated';

export interface RankingUpdateJob {
  userId: string;
  trigger: ScoreUpdateTrigger;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Weight constants for score calculation
export const DESIGNER_SCORE_WEIGHTS = {
  taggedProjects: 0.35,
  completeness: 0.20,
  engagement: 0.15,
  editorial: 0.15,
  vendorDiversity: 0.10,
  recency: 0.05,
} as const;

export const VENDOR_SCORE_WEIGHTS = {
  designerTags: 0.40,
  projectInclusion: 0.25,
  saves: 0.20,
  catalogCompleteness: 0.15,
} as const;

// Recency decay factors
export const RECENCY_DECAY = {
  UNDER_30_DAYS: 1.0,
  UNDER_90_DAYS: 0.8,
  UNDER_180_DAYS: 0.6,
  OVER_180_DAYS: 0.4,
} as const;

// Engagement weights for score calculation
export const ENGAGEMENT_WEIGHTS = {
  saves: 1.0,
  views: 0.1,
  followers: 0.5,
  shares: 2.0,
} as const;

// Editorial contribution weights
export const EDITORIAL_WEIGHTS = {
  articlesAuthored: 5.0,
  superArticlesContributed: 10.0,
  editorialProjectsAchieved: 15.0,
  editorialEditionInclusions: 25.0,
} as const;
