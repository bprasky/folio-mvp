import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SpotlightConflict } from "./gate";

export async function assertNoScheduledHistory(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`;
  if (
    await tx.spotlightQuestion.findFirst({
      where: { spotlight: { projectId } },
      select: { id: true },
    })
  ) {
    throw new SpotlightConflict(
      "SPOTLIGHT_HISTORY_RESTRICTS_DELETION",
      "This project has scheduled spotlight history, including unanswered questions. Keep the project; permanent erasure requires a separately reviewed process.",
    );
  }
}
export async function deleteProjectWithSpotlightGuard(projectId: string) {
  return prisma.$transaction(async (tx) => {
    await assertNoScheduledHistory(tx, projectId);
    return tx.project.delete({ where: { id: projectId } });
  });
}
