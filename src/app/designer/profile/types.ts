/** Shared types for the designer profile mosaic page */

export interface ProfileProject {
  id: string;
  title: string;
  imageUrl: string | null;
  location: string | null;
  type: string | null;
  year: string | null;
  productCount: number;
  views: number;
  saves: number;
}

export interface ProfileProduct {
  id: string;
  name: string;
  vendor: string;
  imageUrl: string | null;
  cropUrl: string | null;
  price: string | number | null;
  category: string | null;
  projectCount: number;
}

export interface ProfileTeamMember {
  id: string;
  name: string;
  role: string;
  headshotUrl: string | null;
  profileImage: string | null;
}

export interface ProfileRecognition {
  id: string;
  title: string;
  source: string;
  date: string | Date;
  excerpt: string | null;
}

export interface ProfileCollaboration {
  vendor: string;
  note: string;
  productCount: number;
}

export interface ProfileQuote {
  text: string;
  attribution?: string;
}

export interface DesignerBioData {
  status: string; // empty | scraped | interviewing | generated | published
  folioBio: string | null;
  sourceUrl: string | null;
  answerCount: number;
}

export interface ProfilePageData {
  user: {
    id: string;
    name: string;
    title: string | null;
    location: string | null;
    bio: string | null;
    profileImage: string | null;
    specialties: string[];
    website: string | null;
    instagram: string | null;
    linkedin: string | null;
  };
  organization: { name: string } | null;
  profileInterview: {
    generatedBio: string | null;
    shortBio: string | null;
    pullQuotes: string[] | null;
    philosophyStatement: string | null;
    processDescription: string | null;
  } | null;
  designerBio: DesignerBioData | null;
  projects: ProfileProject[];
  products: ProfileProduct[];
  teamMembers: ProfileTeamMember[];
  collaborations: ProfileCollaboration[];
  projectCount: number;
  productCount: number;
  isOwner: boolean;
}
