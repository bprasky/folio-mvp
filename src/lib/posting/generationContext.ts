/**
 * What an article is allowed to draw on besides the interview: the designer's
 * bio, and their other published projects.
 *
 * Two callers have to agree about this, and the agreement is the whole point of
 * the file:
 *
 *   THE OFFER  — the checkbox shown before a generation runs.
 *   THE RUN    — what the generate route actually puts in the prompt.
 *
 * If they use different rules, the interface lies in the quietest possible way:
 * a checkbox that promises context the run never finds, or a run that draws on
 * something the designer was never offered the chance to exclude. Nothing errors
 * either way — the prose just comes back slightly different from what was asked
 * for. So the RULES live here as pure functions, and both callers apply them.
 *
 * The queries still differ (the offer counts, the run fetches), which is fine —
 * what must not differ is WHICH bio wins and WHICH projects count as siblings.
 */

import { prisma } from '@/lib/prisma';

/** The org bio as stored, in the shape both callers select. */
export interface OrgBioFields {
  fullBio?: string | null;
  shortBio?: string | null;
  philosophyStatement?: string | null;
}

/**
 * Which bio an article should use, and where it came from.
 *
 * An org-owned project is CREDITED to the firm, so the firm's bio is the
 * relevant voice and the individual's is the fallback. Both are "my bio" from
 * the designer's side — the checkbox does not distinguish, and neither does
 * this.
 */
export function resolveDesignerBio(args: {
  orgBio?: OrgBioFields | null;
  designerBio?: string | null;
}): { text: string; source: 'org' | 'designer' } | null {
  const org = args.orgBio;
  if (org) {
    const composed = [org.fullBio, org.philosophyStatement].filter(Boolean).join('\n\n').trim();
    const text = composed || (org.shortBio ?? '').trim();
    if (text) return { text, source: 'org' };
  }
  const personal = (args.designerBio ?? '').trim();
  if (personal) return { text: personal, source: 'designer' };
  return null;
}

/**
 * Which projects count as "my other projects".
 *
 * On an org-owned project this is the FIRM's body of work, not just the one
 * person's — filtering by designerId alone made a studio's other published
 * projects invisible to every article but the ones that member happened to post.
 */
export function siblingProjectsWhere(args: {
  projectId: string;
  designerId?: string | null;
  orgId?: string | null;
}) {
  const { projectId, designerId, orgId } = args;
  return {
    ...(orgId
      ? { OR: [{ designerOrgId: orgId }, ...(designerId ? [{ designerId }] : [])] }
      : { designerId: designerId ?? undefined }),
    id: { not: projectId },
    isPublic: true,
  };
}

export interface GenerationContextAvailability {
  bio: { available: boolean; source: 'org' | 'designer' | null };
  projectHistory: { available: boolean; count: number };
}

/**
 * Whether each option would actually contribute anything to THIS project's
 * article, answered before the run rather than reported after it.
 *
 * The generate route returns `designerBioMissing` and `hasProjectHistory` in its
 * response, which is too late to be useful: a designer with no bio and no other
 * published work saw two checkboxes that changed nothing, and only learned why
 * after generating. An option that cannot change the output should not be
 * offered, so the surfaces ask this first and render nothing when the answer is
 * no.
 */
export async function getGenerationContextAvailability(
  projectId: string,
): Promise<GenerationContextAvailability> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      designerId: true,
      designer: { select: { bio: true } },
      designerOrg: {
        select: {
          id: true,
          bioInterview: {
            select: { fullBio: true, shortBio: true, philosophyStatement: true },
          },
        },
      },
    },
  });

  if (!project) {
    return { bio: { available: false, source: null }, projectHistory: { available: false, count: 0 } };
  }

  const bio = resolveDesignerBio({
    orgBio: project.designerOrg?.bioInterview,
    designerBio: project.designer?.bio,
  });

  const count = await prisma.project.count({
    where: siblingProjectsWhere({
      projectId,
      designerId: project.designerId,
      orgId: project.designerOrg?.id ?? null,
    }),
  });

  return {
    bio: { available: !!bio, source: bio?.source ?? null },
    projectHistory: { available: count > 0, count },
  };
}
