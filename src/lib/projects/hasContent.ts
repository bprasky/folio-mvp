import { prisma } from "@/lib/prisma";

/**
 * Check if a project has any content (images, rooms, tags, selections, etc.)
 * Used to determine if a project should be archived or directly deleted
 */
export async function projectHasContent(projectId: string): Promise<boolean> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        _count: {
          select: {
            images: true,
            rooms: true,
            selections: true,
            productTags: true,
            meetingNotes: true,
            skeletonItems: true,
            stories: true,
            quotes: true,
            files: true,
            modules: true,
            // Note: threeDAssets excluded as table may not exist in all databases
            // threeDAssets: true,
          },
        },
        post: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!project) {
      return false;
    }

    const counts = project._count;
    
    // Check if project has any content
    const hasContent = 
      counts.images > 0 ||
      counts.rooms > 0 ||
      counts.selections > 0 ||
      counts.productTags > 0 ||
      counts.meetingNotes > 0 ||
      counts.skeletonItems > 0 ||
      counts.stories > 0 ||
      counts.quotes > 0 ||
      counts.files > 0 ||
      counts.modules > 0 ||
      project.post !== null;

    return hasContent;
  } catch (error: any) {
    // If the query fails (e.g., due to missing tables), log and return false
    // This allows the delete operation to proceed even if schema is out of sync
    console.warn('Error checking project content:', error);
    return false;
  }
}


