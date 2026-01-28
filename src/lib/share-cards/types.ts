/**
 * Share Card Types
 * Types for generating shareable quote cards
 */

export type ShareCardVariant = 'instagram_story' | 'instagram_post' | 'linkedin' | 'twitter';

export interface ShareCardData {
  quote: string;
  attribution: string;
  userTitle?: string;
  articleTitle: string;
  articleUrl: string;
  variant: ShareCardVariant;
}

export interface ShareCardConfig {
  width: number;
  height: number;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
}

export const VARIANT_CONFIGS: Record<ShareCardVariant, ShareCardConfig> = {
  instagram_story: {
    width: 1080,
    height: 1920,
    backgroundColor: '#FAF9F7',
    textColor: '#2C2C2C',
    accentColor: '#8B7355',
  },
  instagram_post: {
    width: 1080,
    height: 1080,
    backgroundColor: '#FAF9F7',
    textColor: '#2C2C2C',
    accentColor: '#8B7355',
  },
  linkedin: {
    width: 1200,
    height: 627,
    backgroundColor: '#FAF9F7',
    textColor: '#2C2C2C',
    accentColor: '#8B7355',
  },
  twitter: {
    width: 1200,
    height: 675,
    backgroundColor: '#FAF9F7',
    textColor: '#2C2C2C',
    accentColor: '#8B7355',
  },
};

export const VARIANT_LABELS: Record<ShareCardVariant, string> = {
  instagram_story: 'Instagram Story',
  instagram_post: 'Instagram Post',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
};

export interface ShareCardResult {
  id: string;
  contributionId: string;
  imageUrl: string;
  quote: string;
  attribution: string;
  articleTitle: string;
  articleUrl: string;
  variant: ShareCardVariant;
  generatedAt: Date;
}

export interface GenerateShareCardOptions {
  contributionId: string;
  variant: ShareCardVariant;
  customQuote?: string;
}
