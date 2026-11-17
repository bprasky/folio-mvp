/** A public photo portfolio is separate from a published Folio Feature. */
export function hasPublishedProjectFeature(project: { isPublic?: boolean; post?: { status: string } | null } | null | undefined): boolean {
  return project?.isPublic === true && project.post?.status === 'PUBLISHED';
}

export const PROJECT_FEATURE_REQUIRED = 'Complete this project’s interview and publish its Folio Feature to unlock publishing tools.';

export function projectInterviewProgress(value: unknown) {
  const object = (input: unknown): Record<string, unknown> => input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const interview = object(object(value).interview), guided = object(interview.guided);
  const answers = object(interview.payload).answers;
  return { started: Boolean(guided.id) || (Array.isArray(answers) && answers.length > 0), complete: guided.status === 'finished' };
}

export type ProjectFeatureStep = 'interview' | 'draft' | 'review' | 'published' | 'archived';
export type ProjectPublicationInvitation = {
  id: string; title: string; thumbnail: string | null; photosOnProfile: boolean;
  step: ProjectFeatureStep; status: string; action: string; href: string;
};

export function projectFeatureNextStep(input: {
  id: string; isPublic: boolean; featureStatus?: string | null; hasDraft?: boolean;
  interviewStarted?: boolean; interviewComplete?: boolean;
}): Pick<ProjectPublicationInvitation, 'step' | 'status' | 'action' | 'href'> {
  const base = `/project/${encodeURIComponent(input.id)}`;
  if (input.isPublic && input.featureStatus === 'PUBLISHED') return { step: 'published', status: 'Feature published', action: 'Open Publishing Studio', href: `/designer/studio?project=${encodeURIComponent(input.id)}` };
  if (input.featureStatus === 'REVIEW') return { step: 'review', status: 'Feature in review', action: 'View feature review', href: `${base}?view=publish` };
  if (input.featureStatus === 'ARCHIVED') return { step: 'archived', status: 'Feature archived', action: 'Open project', href: base };
  if (input.hasDraft) return { step: 'draft', status: 'Feature draft ready', action: 'Review & publish feature', href: `${base}?view=publish` };
  return { step: 'interview', status: input.interviewComplete ? 'Interview complete' : input.interviewStarted ? 'Interview in progress' : 'Interview needed',
    action: input.interviewComplete ? 'Create Folio Feature' : input.interviewStarted ? 'Continue interview' : 'Start interview', href: `${base}?view=story` };
}
