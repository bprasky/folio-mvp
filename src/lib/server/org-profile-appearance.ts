import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  readOrgAppearance,
  resolveProfileCover,
  type OrgAppearanceData,
  type ProfileProjectChoice,
} from '@/lib/org-profile-appearance';

/** Public presentation only. Admin callers use the same photo eligibility: choosing
 * a cover must never publish a private project or a photo excluded from its story. */
export async function getOrgProfileAppearanceData(orgId: string): Promise<OrgAppearanceData | null> {
  const [organization, projectCount, projects] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true, name: true, type: true, logo: true, description: true,
        tagline: true, location: true, foundedYear: true, specialties: true,
        serviceRegions: true, projectTypes: true, teamSizeRange: true,
        profileAppearance: true,
      },
    }),
    prisma.project.count({ where: { designerOrgId: orgId, isPublic: true } }),
    prisma.project.findMany({
      where: { designerOrgId: orgId, isPublic: true },
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      take: 20,
      select: {
        id: true, title: true,
        images: {
          where: { inclusion: 'INCLUDED' },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
          take: 3,
          select: { id: true, url: true },
        },
      },
    }),
  ]);

  if (!organization) return null;
  const { profileAppearance, ...org } = organization;
  const appearance = readOrgAppearance(profileAppearance);
  const choices: ProfileProjectChoice[] = projects;

  // Re-resolve a saved selection independently of the bounded picker. An older
  // valid cover remains visible; withdrawal, exclusion or reassignment removes it.
  if (appearance.cover.kind === 'project') {
    const imageId = appearance.cover.imageId;
    const selected = await prisma.projectImage.findFirst({
      where: {
        id: imageId,
        inclusion: 'INCLUDED',
        project: { designerOrgId: orgId, isPublic: true },
      },
      select: { id: true, url: true, project: { select: { id: true, title: true } } },
    });
    // Use the fresh eligibility check even if the image appeared in the picker.
    for (const project of choices) project.images = project.images.filter(image => image.id !== imageId);
    if (selected) {
      const project = choices.find(candidate => candidate.id === selected.project.id);
      const image = { id: selected.id, url: selected.url };
      if (project) project.images.push(image);
      else choices.push({ ...selected.project, images: [image] });
    }
  }

  return {
    org,
    appearance,
    projects: choices,
    projectCount,
    cover: resolveProfileCover(appearance, choices),
  };
}
