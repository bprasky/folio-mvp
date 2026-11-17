import 'server-only';
import { prisma } from '@/lib/prisma';
import { resolvePublishingStudioContext } from './data';
import { hasPublishedProjectFeature, projectFeatureNextStep, projectInterviewProgress, type ProjectPublicationInvitation } from '@/lib/publish/projectPublication';

/** Owner prompts only: never transport draft prose, interview answers or provenance. */
export async function getStudioProjectInvitations(actor: string): Promise<ProjectPublicationInvitation[]> {
  const workspace = await resolvePublishingStudioContext(actor);
  const projects = await prisma.project.findMany({
    where: { designerOrgId: workspace.id,
      ...(workspace.id && workspace.canWriteCampaigns ? {} : { OR: [{ ownerId: actor }, { designerId: actor }] }),
      NOT: { isPublic: true, post: { is: { status: 'PUBLISHED' } } },
    },
    select: { id: true, title: true, isPublic: true,
      post: { select: { status: true, expandedBlocks: true, provenance: true } },
      editorialInterviews: { select: { status: true } },
      images: { where: { inclusion: 'INCLUDED' }, select: { url: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], take: 1 },
    }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 100,
  });
  return projects.filter(project => !hasPublishedProjectFeature(project)).map(project => {
    const interview = projectInterviewProgress(project.post?.provenance);
    return { id: project.id, title: project.title, thumbnail: project.images[0]?.url ?? null, photosOnProfile: project.isPublic,
      ...projectFeatureNextStep({ id: project.id, isPublic: project.isPublic, featureStatus: project.post?.status,
        hasDraft: project.post?.expandedBlocks != null, interviewStarted: interview.started,
        interviewComplete: interview.complete || project.editorialInterviews.some(item => ['COMPLETED', 'PUBLISHED'].includes(item.status)),
      }),
    };
  });
}
