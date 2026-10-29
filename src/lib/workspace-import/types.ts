import type { GuidedPreparation } from '@/lib/interview/guided/types';

export const WORKSPACE_IMPORT_KIND = 'workspace-import-v1';
export const IMPORT_LIMITS = { pages: 18, projects: 10, photos: 30 } as const;
export type ImportSection = 'business' | 'bio' | 'projects';
export type ImportPage = {
  url: string; kind: 'home' | 'about' | 'portfolio' | 'bio' | 'project';
  status: 'pending' | 'saved' | 'failed'; attempts: number; error?: string;
};
export type ImportedProject = {
  url: string; title: string; description: string; projectId?: string;
  photos: Array<{ url: string; alt: string; status: 'pending' | 'saved' | 'failed'; imageId?: string; savedUrl?: string; width?: number; height?: number; attempts: number }>;
  status: 'pending' | 'photos' | 'questions' | 'ready' | 'failed'; error?: string;
  preparation?: GuidedPreparation; attempts: number;
};
export type WorkspacePreviewProject = {
  id: string; title: string; description: string | null; isPublic: boolean;
  photos: Array<{ url: string; alt: string; width?: number; height?: number }>;
};
export type ProfileDraft = {
  description: string; location: string; website: string; foundedYear?: number;
  logo?: string; logoSource?: string;
  sourceUrl?: string; bioSourceUrl?: string; bio?: string;
  bioQuestions?: Array<{ id: string; question: string; round?: string }>;
  bioFingerprint?: string;
  bioRole?: string;
  businessApplied?: boolean; bioApplied?: boolean;
};
export type WorkspaceImport = {
  kind: typeof WORKSPACE_IMPORT_KIND; orgId: string; orgName: string; personName: string;
  website: string; bioUrl?: string; sections: ImportSection[]; returnTo: string;
  requestedProjectUrls?: string[]; retryCount?: number;
  consentAt: string; consentVersion: 1;
  phase: 'discover' | 'profiles' | 'projects' | 'notify' | 'complete' | 'blocked';
  pages: ImportPage[]; projects: ImportedProject[]; profile: ProfileDraft;
  notices: string[]; profileAttempts: number; profileReady: boolean; profileFailed?: boolean;
  lease?: { token: string; until: string };
  recoveries?: number;
  notification: { status: 'pending' | 'accepted' | 'failed'; attempts: number; firstAttemptAt?: string; nextAttemptAt?: string; error?: string;
    message?: { to: string; subject: string; html: string } };
};

export function isWorkspaceImport(value: unknown): value is WorkspaceImport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const run = value as WorkspaceImport;
  return run.kind === WORKSPACE_IMPORT_KIND && typeof run.orgId === 'string' &&
    Array.isArray(run.sections) && Array.isArray(run.pages) && Array.isArray(run.projects) && !!run.profile && !!run.notification;
}

export function importSummary(run: WorkspaceImport) {
  const projects = run.projects.filter(project => project.projectId);
  return { projects: projects.length, photos: projects.reduce((sum, project) => sum + project.photos.filter(photo => photo.status === 'saved').length, 0),
    interviews: projects.filter(project => project.status === 'ready' && project.preparation).length,
    business: run.sections.includes('business') && !!(run.profile.description || run.profile.logo),
    bio: run.sections.includes('bio') && !!run.profile.bio,
    needsAttention: run.notices.length > 0 || run.pages.some(page => page.status === 'failed') || run.projects.some(project => project.status === 'failed' || project.photos.some(photo => photo.status === 'failed')) };
}

export function hasUnfinishedItems(run: WorkspaceImport) {
  return run.phase === 'blocked' || run.profileFailed || run.pages.some(page => page.status === 'failed') ||
    run.projects.some(project => project.status === 'failed' || project.photos.some(photo => photo.status === 'failed'));
}
