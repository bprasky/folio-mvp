'use server';

import { createProjectOnce } from '@/lib/projects/createProject';
import { canCreateFirmProject } from '@/lib/orgPermissions';
import { stripPrivateInterviewData } from '@/lib/spotlight/privacy';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole, canCreateProject } from '@/lib/permissions';
import { assertProjectPublish } from '@/lib/authz/access';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { notifyIncompleteProductVendors } from '@/lib/notifications/notifyIncompleteProductVendors';
import { triggerQueueUnlockForProject } from '@/lib/editorial-queue/unlock';
import { computePublishReadiness, isDocumentImage } from '@/lib/publish/computePublishReadiness';
import { initiateEditorial, transitionEditorial } from '@/lib/editorial/lifecycle';

// Type definitions for project-related data
interface ProjectWithImages {
  id: string;
  images: Array<{
    id: string;
    url: string;
    imageSignals: unknown;
  }>;
  rooms: Array<{
    type: string | null;
  }>;
  description: string | null;
}

/** Path B remains available with Posting V1 disabled. */
export async function createEditorialDraft({ projectId }: { projectId: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false, message: 'Unauthorized', statusCode: 401 };
  try {
    const post = await initiateEditorial(session.user.id, projectId);
    return { ok: true, message: 'Draft ready', projectPostId: post.id, slug: post.slug, status: post.status };
  } catch (error: any) {
    return { ok: false, message: error.message, statusCode: error.status ?? (error.message === 'Forbidden' ? 403 : error.message === 'NotFound' ? 404 : 500) };
  }
}

export async function publishEditorial({ projectId }: { projectId: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false, message: 'Unauthorized', statusCode: 401 };
  try {
    const post = await transitionEditorial({ userId: session.user.id, projectId, action: 'publish' });
    revalidatePath('/project/' + projectId);
    revalidatePath('/p/' + post.slug);
    revalidatePath('/editorial');
    if (post.changed) {
      notifyIncompleteProductVendors(projectId);
      triggerQueueUnlockForProject(projectId).catch(err => console.error('[publishEditorial] Queue unlock failed:', err));
    }
    return { ok: true, message: 'Published successfully', projectPostId: post.id, slug: post.slug };
  } catch (error: any) {
    return { ok: false, message: error.message, statusCode: error.status ?? (error.message === 'Forbidden' ? 403 : error.message === 'NotFound' ? 404 : 500) };
  }
}

/**
 * @deprecated Use POST /api/projects instead. This action is kept for backward compatibility.
 * Always creates projects as draft and redirects to Media tab.
 */
export async function createProjectAction(input: {
  name: string;
  description?: string;
  requestId?: string;
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

  // Require org context — no orphan projects
  const operatingAsOrgId = (session?.user as any)?.operatingAsOrgId as string | null ?? null;
  let designerOrgId: string | null = operatingAsOrgId;

  // Fallback: read from DB if not in session
  if (!designerOrgId) {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { operatingAsOrgId: true },
    });
    designerOrgId = userRecord?.operatingAsOrgId ?? null;
  }

  // Validate membership if we have an org
  if (designerOrgId) {
    const membership = await prisma.organizationUser.findFirst({
      where: { userId, organizationId: designerOrgId, isActive: true },
      select: { id: true, role: true, organization: { select: { type: true } } },
    });
    if (!membership || !canCreateFirmProject(membership.role, membership.organization.type)) {
      throw new Error('You are not a member of this organization');
    }
  } else {
    throw new Error('Organization context required to create projects');
  }

  if (!input.requestId || !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId)) throw new Error('Reload the creation form before retrying. A stable request ID is required.');
  const project = await createProjectOnce(userId, designerOrgId, input.requestId, {
    title: input.name.trim(), description: input.description?.trim() || null, projectStatus: 'new_project',
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

  // Authorization: matrix-gated via assertProjectPublish (src/lib/authz).
  // Allows org Owner/Admin/Manager (per src/lib/orgPermissions.ts), the
  // creator of a non-org project, global admins, and project-level OWNER
  // participants. Previously was creator-only, which blocked partner-led
  // studios from publishing junior designers' work.
  try {
    await assertProjectPublish(userId, projectId);
  } catch {
    throw new Error('Not authorized to publish this project');
  }

  // Publish gate backstop (spec 20 §3e). The spine never surfaces "Publish"
  // while blocked, but the server enforces room completeness as the source of
  // truth. Tagging is deliberately NOT enforced here: it is confirmed in the UI
  // at the moment of publish, not required. Idempotent re-publish of an
  // already-public project is still allowed (the gate only guards the first
  // transition to public).
  if (!project.isPublic) {
    const readiness = computePublishReadiness({
      photos: project.images
        .filter(img => !isDocumentImage(img.name))
        .map(img => ({
          id: img.id,
          inclusion: img.inclusion,
          roomId: img.roomId,
          room: img.room,
          noProducts: img.noProducts,
          tagCount: img.tags.length,
        })),
      roomCount: 0, // unused for canPublish
      storyComplete: true, // story is optional for publish
    });

    if (!readiness.canPublish) {
      throw new Error('Sort every photo into a room before publishing.');
    }
  }

  // Idempotent publish - only set publishedAt if not already set
  const publishedAt = project.publishedAt ?? new Date();

  // A project with editorial content must use the same post lifecycle. The
  // dashboard cannot make a REVIEW/ARCHIVED article's project public directly.
  const existingPost = await prisma.projectPost.findUnique({ where: { projectId }, select: { id: true } });
  if (existingPost) await transitionEditorial({ userId, projectId, action: 'publish' });
  const updated = existingPost ? await prisma.project.findUniqueOrThrow({ where: { id: projectId } }) : await prisma.project.update({
    where: { id: projectId, post: { is: null } },
    data: {
      isPublic: true,
      status: 'published',
      publishedAt,
    },
  });

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
      const projectIds = projects.map((p: { id: string }) => p.id);
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
      const interviews = await stripPrivateInterviewData(await prisma.editorialInterview.findMany({
        where: {
          projectId: { in: projectIds },
          status: 'COMPLETED',
        },
        include: {
          answers: {
            select: {
              questionId: true, answerText: true,
            },
          },
        },
      }));

      // Build detection input
      const detectionInput = {
        projects: projects.map((project: ProjectWithImages) => ({
          id: project.id,
          images: project.images.map((img: { url: string; imageSignals: unknown }) => ({
            url: img.url,
            precomputedSignals: img.imageSignals as any,
          })),
          productTags: productTags
            .filter((tag: { image: { projectId: string }; product: { category: string | null } }) => tag.image.projectId === project.id)
            .map((tag: { image: { projectId: string }; product: { category: string | null } }) => ({
              product: {
                category: tag.product.category || undefined,
                materials: [],
              },
            })),
          rooms: project.rooms.map((room: { type: string | null }) => ({
            type: room.type || '',
            materials: [],
          })),
          description: project.description || undefined,
        })),
        interviews: interviews.map((interview: { answers: Array<{ answerText: string }> }) => ({
          transcript: interview.answers.map((a: { answerText: string }) => a.answerText).join(' '),
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
