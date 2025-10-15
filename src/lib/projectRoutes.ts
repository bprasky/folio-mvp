/**
 * Project routing utilities
 * Determines correct URLs for draft vs published projects
 */

export type ProjectNav = {
  id: string;
  slug?: string | null;
  isPublic?: boolean | null;
  publishedAt?: Date | string | null;
};

export function isPublished(p: ProjectNav): boolean {
  return !!p.isPublic || !!p.publishedAt;
}

export function hrefForProject(p: ProjectNav): string {
  return isPublished(p) 
    ? `/project/${p.slug ?? p.id}` 
    : `/project/${p.id}/media?onboard=1`;
}




