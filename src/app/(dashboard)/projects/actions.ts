'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

const updateProjectStageSchema = z.object({
  projectId: z.string().uuid(),
  stage: z.enum(['concept', 'schematic', 'design_development', 'cd_pre_spec', 'spec_locked', 'in_procurement', 'install'])
});

export async function updateProjectStage(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const rawData = {
      projectId: formData.get('projectId'),
      stage: formData.get('stage')
    };

    const validatedData = updateProjectStageSchema.parse(rawData);

    // Check if project exists and user owns it
    const project = await prisma.project.findUnique({
      where: { id: validatedData.projectId },
      select: { ownerId: true, designerId: true }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // User must be either owner or designer
    if (project.ownerId !== session.user.id && project.designerId !== session.user.id) {
      throw new Error('Unauthorized to modify this project');
    }

    // Update the project stage
    await prisma.project.update({
      where: { id: validatedData.projectId },
      data: { stage: validatedData.stage }
    });

    revalidatePath('/projects');
    return { success: true };
  } catch (error) {
    console.error('Error updating project stage:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

