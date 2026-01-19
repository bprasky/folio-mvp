// Profile System Types

export interface ProfileUser {
  id: string;
  name: string;
  email: string;
  role: string;
  profileImage?: string | null;
  bio?: string | null;
  title?: string | null;
  location?: string | null;
  website?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  specialties?: string[];
  followers?: number;
  following?: number;
  createdAt?: string | Date;
  // Architect-specific
  architectLicenseNumber?: string | null;
  architectLicensedStates?: string[];
  architectProjectScale?: string[];
  architectSpecializations?: string[];
  // Builder-specific
  builderProjectTypes?: string[];
  builderSquareFootageRange?: string | null;
  builderSpecialtyTrades?: string[];
  builderYearsInBusiness?: number | null;
}

export interface ProfileInterview {
  generatedBio?: string | null;
  shortBio?: string | null;
  pullQuotes?: string[] | null;
  philosophyStatement?: string | null;
  processDescription?: string | null;
  status?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  headshotUrl?: string | null;
  bio?: string | null;
  linkedUser?: {
    id: string;
    name: string;
    profileImage?: string | null;
  } | null;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  logo?: string | null;
}

export type ContentType = 'project' | 'media' | 'recognition' | 'collaboration';

export interface FeedItem {
  id: string;
  type: ContentType;
  data: any;
  publishedAt: string | Date | null;
  pinnedAt: string | Date | null;
  pinOrder?: number | null;
  engagement: number;
}

export interface PinnedItem {
  id: string;
  type: ContentType;
  data: any;
  pinOrder?: number | null;
}

// Media types
export type MediaType =
  | 'VIDEO'
  | 'PODCAST'
  | 'INTERVIEW'
  | 'WEBINAR'
  | 'SPEAKING'
  | 'BEHIND_THE_SCENES';

export interface Media {
  id: string;
  title: string;
  type: MediaType;
  description?: string | null;
  thumbnailUrl?: string | null;
  sourceUrl?: string | null;
  hostedUrl?: string | null;
  duration?: number | null;
  views?: number;
  saves?: number;
  shares?: number;
  publishedAt?: string | Date | null;
}

// Recognition types
export type RecognitionType =
  | 'PRESS'
  | 'AWARD'
  | 'EDITORIAL'
  | 'SPEAKING'
  | 'CERTIFICATION';

export interface Recognition {
  id: string;
  title: string;
  type: RecognitionType;
  source: string;
  sourceLogoUrl?: string | null;
  date: string | Date;
  url?: string | null;
  imageUrl?: string | null;
  excerpt?: string | null;
  publishedAt?: string | Date | null;
}

// Collaboration types
export type CollabType =
  | 'FORMAL_PARTNERSHIP'
  | 'PROJECT'
  | 'PRODUCT_FEATURE'
  | 'JOINT_VENTURE';

export interface Collaboration {
  id: string;
  title: string;
  type: CollabType;
  description?: string | null;
  imageUrl?: string | null;
  partnerName?: string | null;
  partnerLogo?: string | null;
  projectId?: string | null;
  publishedAt?: string | Date | null;
}

// Project type for feed
export interface Project {
  id: string;
  title?: string;
  name?: string;
  imageUrl?: string;
  city?: string;
  regionState?: string;
  saveCount?: number;
  saves?: number;
  projectType?: string;
  publishedAt?: string | Date | null;
}
