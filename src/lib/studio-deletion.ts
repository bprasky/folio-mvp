export const STUDIO_TYPES = ['DESIGN_FIRM', 'ARCHITECTURE_FIRM', 'CONTRACTOR'] as const;
export function isDeletableStudioType(type: string) {
  return (STUDIO_TYPES as readonly string[]).includes(type);
}

export type StudioDeletionReview = {
  id: string;
  name: string;
  version: string;
  counts: { projects: number; publishedProjects: number; members: number; profileItems: number };
  blockers: string[];
};

export type StudioDeletionInput = { confirmation: string; version: string; acknowledged: true };
