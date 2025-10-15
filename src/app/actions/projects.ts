'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole, canCreateProject } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export async function createProjectAction(input: {
  name: string;
  description?: string;
  intent: 'folder' | 'publish_now';
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const role = normalizeRole(session?.user?.role);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    throw new Error('User ID not found in session');
  }

  if (!canCreateProject(role)) {
    throw new Error('Your role is not permitted to create projects');
  }

  // Create the project
  const project = await prisma.project.create({
    data: {
      title: input.name.trim(),
      description: input.description?.trim() || null,
      designerId: userId,
      ownerId: userId,
      status: input.intent === 'publish_now' ? 'published' : 'draft',
      isPublic: input.intent === 'publish_now',
      publishedAt: input.intent === 'publish_now' ? new Date() : null,
      isAIEnabled: false,
      views: 0,
      saves: 0,
      shares: 0,
    },
    select: { id: true, title: true },
  });

  // Revalidate paths to show new project immediately
  revalidatePath('/designer/profile'); // Profile page
  revalidatePath('/designer');          // Dashboard
  revalidatePath('/projects');          // Global project list

  if (process.env.NODE_ENV === 'development') {
    console.log('[createProjectAction]', { 
      email: session.user?.email, 
      role, 
      userId, 
      projectId: project.id,
      intent: input.intent,
      ownership: { designerId: userId, ownerId: userId }
    });
  }

  return { ok: true, projectId: project.id };
}

/**
 * Publishes a draft project (sets isPublic: true, publishedAt timestamp)
 * Idempotent - safe to call multiple times
 */
const PublishInput = z.object({ projectId: z.string().uuid() });

export async function publishProjectAction(raw: unknown) {
  const { projectId } = PublishInput.parse(raw);
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Fetch project with tagged products
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      designerId: true,
      isPublic: true,
      publishedAt: true,
      title: true,
      images: {
        include: {
          tags: {
            select: { productId: true }
          }
        }
      }
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // Authorization: user must be owner or designer
  if (project.ownerId !== userId && project.designerId !== userId) {
    throw new Error('Not authorized to publish this project');
  }

  // Idempotent publish - only set publishedAt if not already set
  const publishedAt = project.publishedAt ?? new Date();

  // Update project to published state
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      isPublic: true,
      status: 'published',
      publishedAt,
    },
  });

  // TODO: Generate affiliate links for tagged products
  // When AffiliateLink model is added, uncomment:
  /*
  try {
    for (const image of project.images) {
      for (const tag of image.tags) {
        await prisma.affiliateLink.upsert({
          where: {
            designerId_projectId_productId: {
              designerId: project.designerId!,
              projectId: project.id,
              productId: tag.productId,
            }
          },
          create: {
            code: ulid(),
            designerId: project.designerId!,
            projectId: project.id,
            productId: tag.productId,
          },
          update: {}, // No-op if exists
        });
      }
    }
  } catch (error) {
    // Fail-soft if AffiliateLink doesn't exist yet
    console.warn('[publishProject] Affiliate link generation skipped:', error);
  }
  */

  // Revalidate relevant paths
  revalidatePath('/designer/profile'); // Profile page (most important)
  revalidatePath('/designer');          // Dashboard
  revalidatePath('/projects');          // Global list
  revalidatePath(`/project/${projectId}`); // Project detail page
  if (project.designerId) {
    revalidatePath(`/designer/${project.designerId}`);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[publishProjectAction]', {
      projectId,
      userId,
      wasPublic: project.isPublic,
      publishedAt,
    });
  }

  return { ok: true, project: updated };
}
