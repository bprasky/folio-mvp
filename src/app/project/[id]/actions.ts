'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const Input = z.object({ projectId: z.string().uuid() });

export async function deleteProjectAction(raw: unknown) {
  const { projectId } = Input.parse(raw);

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');

  // Ensure ownership - user must be either owner or designer
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true, designerId: true },
  });
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  if (project.ownerId !== session.user.id && project.designerId !== session.user.id) {
    throw new Error('Not authorized to delete this project');
  }

  // Transactional cleanup - Prisma will handle cascading deletes automatically
  // but we'll use a transaction for safety
  await prisma.$transaction(async (tx) => {
    // Delete project (cascading deletes will handle related records)
    await tx.project.delete({ where: { id: projectId } });
  });

  // Revalidate and redirect
  revalidatePath('/projects');
  redirect('/projects');
}

