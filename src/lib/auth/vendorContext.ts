import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function getVendorContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  // 1) Cookie override (works even if membership is broken)
  // Only accept it if the user actually has membership to that org.
  const c = cookies();
  const viewAs = c.get("view_as_org")?.value ?? null;

  const E: any = (Prisma as any).$Enums ?? (Prisma as any);
  const OrganizationType = E.OrganizationType ?? {};

  // If cookie present, verify membership
  if (viewAs) {
    const m = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        organizationId: viewAs,
        organization: { type: OrganizationType.VENDOR ?? "VENDOR" },
      },
      select: { 
        organizationId: true, 
        organization: { 
          select: { 
            id: true, 
            name: true, 
            description: true 
          } 
        } 
      },
    });
    if (m) {
      return { vendorOrgId: m.organizationId, vendor: m.organization };
    }
  }

  // 2) Normal membership-based resolution
  const membership = await prisma.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
      organization: { type: OrganizationType.VENDOR ?? "VENDOR" },
    },
    select: { 
      organizationId: true, 
      organization: { 
        select: { 
          id: true, 
          name: true, 
          description: true 
        } 
      } 
    },
  });

  if (!membership) return null;

  return {
    vendorOrgId: membership.organizationId,
    vendor: membership.organization,
  };
}
