export interface StudioData {
  workspace: { id: string | null; name: string };
  projects: { id: string; title: string; thumbnail: string | null; published: boolean; canCreate: boolean }[];
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
