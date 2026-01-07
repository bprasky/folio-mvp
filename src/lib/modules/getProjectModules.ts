import { prisma } from "@/lib/prisma";

export async function getProjectModules(projectId: string) {
  return prisma.projectModule.findMany({
    where: { projectId, publishedAt: { not: null } },
    orderBy: [
      { pinned: "desc" },
      { type: "asc" },
      { publishedAt: "desc" },
    ],
  });
}


