import prisma from "@/lib/prisma";

export async function canAccessCheckIn(
  userId: string,
  userRole: string,
  eventId: string
): Promise<boolean> {
  // Admins can check in at any event
  if (userRole === "ADMIN") return true;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { createdById: true, organizationId: true },
  });
  if (!event) return false;

  // Event creator can check in
  if (event.createdById === userId) return true;

  // Org members with OWNER/ADMIN/MANAGER role can check in
  if (event.organizationId) {
    const orgUser = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: event.organizationId,
        },
      },
      select: { role: true, isActive: true },
    });
    if (
      orgUser?.isActive &&
      ["OWNER", "ADMIN", "MANAGER"].includes(orgUser.role)
    ) {
      return true;
    }
  }

  return false;
}
