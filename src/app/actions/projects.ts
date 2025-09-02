'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole, canCreateProject } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

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
      name: input.name.trim(),
      description: input.description?.trim() || null,
      designerId: userId,
      ownerId: userId,
      status: input.intent === 'publish_now' ? 'active' : 'draft',
      isPublic: input.intent === 'publish_now',
      isAIEnabled: false,
      views: 0,
      saves: 0,
      shares: 0,
    },
    select: { id: true, name: true },
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('[createProjectAction]', { 
      email: session.user?.email, 
      role, 
      userId, 
      projectId: project.id,
      intent: input.intent 
    });
  }

  return { ok: true, projectId: project.id };
}
