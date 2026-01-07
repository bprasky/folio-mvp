'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole, canCreateProject } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

/**
 * @deprecated Use POST /api/projects instead. This action is kept for backward compatibility.
 * Always creates projects as draft and redirects to Media tab.
 */
export async function createProjectAction(input: {
  name: string;
  description?: string;
  intent: 'folder' | 'publish_now'; // DEPRECATED: intent is ignored, always creates as draft
}) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[createProjectAction] DEPRECATED: Use POST /api/projects instead. Intent param is ignored.');
  }

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

  // Always create as draft - ignore intent param
  const project = await prisma.project.create({
    data: {
      title: input.name.trim(),
      description: input.description?.trim() || null,
      designerId: userId,
      ownerId: userId,
      status: 'draft', // Explicitly set - always draft regardless of intent
      isPublic: false, // Explicitly set
      publishedAt: null, // Explicitly set
      isAIEnabled: false,
      views: 0,
      saves: 0,
      shares: 0,
    },
    select: { id: true, title: true },
  });

  // Log analytics event
  try {
    const { logPassiveEvent } = await import('@/lib/analytics');
    await logPassiveEvent({
      projectId: project.id,
      type: 'project_create',
      actorId: userId,
      payload: { source: 'createProjectAction_deprecated' }
    });
  } catch (analyticsError) {
    console.warn('Analytics logging failed:', analyticsError);
  }

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

  // Trigger aesthetic detection when they hit 2-3 published projects
  // Run async (don't block publish)
  if (project.designerId) {
    detectAndSaveAesthetic(project.designerId).catch((error) => {
      console.error('[publishProjectAction] Aesthetic detection failed:', error);
    });
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

/**
 * Helper function to detect and save aesthetic profile
 * Called asynchronously after project publish
 */
async function detectAndSaveAesthetic(designerId: string) {
  try {
    // Count published projects
    const publishedCount = await prisma.project.count({
      where: {
        designerId,
        OR: [
          { isPublic: true },
          { publishedAt: { not: null } },
          { status: 'published' },
        ],
      },
    });

    // Trigger detection when they hit 2-4 published projects
    if (publishedCount >= 2 && publishedCount <= 4) {
      // Import detection function directly (more reliable than API call)
      const { detectAesthetic } = await import('@/lib/aesthetic');
      
      // Fetch projects with full data
      const projects = await prisma.project.findMany({
        where: {
          designerId,
          OR: [
            { isPublic: true },
            { publishedAt: { not: null } },
            { status: 'published' },
          ],
        },
        include: {
          images: {
            select: {
              id: true,
              url: true,
              imageSignals: true,
            },
          },
          rooms: {
            select: {
              type: true,
            },
          },
        },
      });

      if (projects.length < 2) return;

      // Fetch product tags
      const projectIds = projects.map((p) => p.id);
      const productTags = await prisma.productTag.findMany({
        where: {
          image: {
            projectId: { in: projectIds },
          },
        },
        include: {
          product: {
            select: {
              category: true,
            },
          },
          image: {
            select: {
              id: true,
              projectId: true,
            },
          },
        },
      });

      // Fetch interviews
      const interviews = await prisma.editorialInterview.findMany({
        where: {
          projectId: { in: projectIds },
          status: 'COMPLETED',
        },
        include: {
          answers: {
            select: {
              answerText: true,
            },
          },
        },
      });

      // Build detection input
      const detectionInput = {
        projects: projects.map((project) => ({
          id: project.id,
          images: project.images.map((img) => ({
            url: img.url,
            precomputedSignals: img.imageSignals as any,
          })),
          productTags: productTags
            .filter((tag) => tag.image.projectId === project.id)
            .map((tag) => ({
              product: {
                category: tag.product.category || undefined,
                materials: [],
              },
            })),
          rooms: project.rooms.map((room) => ({
            type: room.type || '',
            materials: [],
          })),
          description: project.description || undefined,
        })),
        interviews: interviews.map((interview) => ({
          transcript: interview.answers.map((a) => a.answerText).join(' '),
        })),
      };

      // Run detection
      const aestheticProfile = await detectAesthetic(detectionInput);

      // Save to database
      await prisma.user.update({
        where: { id: designerId },
        data: {
          aestheticProfile: aestheticProfile as any,
          aestheticDetectedAt: new Date(),
        },
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[detectAndSaveAesthetic] Detected aesthetic:', {
          designerId,
          theme: aestheticProfile.theme,
          confidence: aestheticProfile.confidence,
        });
      }
    }
  } catch (error) {
    // Fail-soft: don't break publish flow if detection fails
    console.error('[detectAndSaveAesthetic] Error:', error);
  }
}
