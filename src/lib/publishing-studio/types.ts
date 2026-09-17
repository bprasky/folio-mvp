export interface StudioFeedCard {
  id: string; projectIds: string[]; title: string; caption: string;
  imageUrl: string | null; imageUrls: string[];
  kind: 'suggestion' | 'carousel' | 'campaign' | 'idea';
  format: string; status: string; updatedAt: string;
  exportId?: string; campaignId?: string; roomId?: string; canPolish: boolean; revision?: string;
  pitch?: string; rationale?: string; beats?: string[]; slideCount?: number;
  headlineOptions?: string[]; captionOptions?: string[];
  preview?: { headlinePosition: 'bottom_left' | 'bottom_center' | 'top_left'; watermarkStyle: 'folio_x' | 'folio_presents' | 'minimal'; aspectRatio: '1:1' | '4:5' | '9:16'; watermarkText?: string };
}

export interface StudioData {
  feed: StudioFeedCard[];
  workspace: { id: string | null; name: string };
  projects: { id: string; title: string; thumbnail: string | null; published: boolean; canCreateCampaign: boolean; canCreate: boolean }[];
  editorials: { id: string; projectId: string; title: string; slug: string; status: string; format: string; updatedAt: string }[];
  ideas: {
    id: string; title: string; format: string; status: string; createdAt: string;
    projectIds: string[]; prompts: { id: string; prompt: string; hint?: string }[]; reason: string;
  }[];
  posts: {
    id: string; projectId: string; title: string; caption: string; status: string;
    updatedAt: string; kind: 'carousel' | 'campaign_post'; campaignId?: string;
  }[];
  campaigns: {
    id: string; projectId: string; title: string; preset: string; createdAt: string;
    totalPosts: number; postCount: number;
    posts: { id: string; title: string; caption: string; sequenceNum: number }[];
  }[];
  truncated: boolean;
}
