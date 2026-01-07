import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const info: any = {
    authed: !!session?.user?.id,
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
    memberships: [],
    vendorOrgs: [],
    viewingAsOrgId: null,
  };
  
  try {
    // read cookie override
    const viewingAsOrgId = req.headers.get("cookie")?.match(/view_as_org=([^;]+)/)?.[1] ?? null;
    info.viewingAsOrgId = viewingAsOrgId;

    if (info.userId) {
      info.memberships = await prisma.organizationUser.findMany({
        where: { userId: info.userId, isActive: true },
        select: {
          organizationId: true,
          role: true,
          organization: { select: { id: true, name: true, type: true } },
        },
      });

      info.vendorOrgs = info.memberships
        .filter(m => m.organization?.type === "VENDOR")
        .map(m => m.organization);
    }
  } catch (e: any) {
    info.error = String(e?.message ?? e);
  }
  
  return NextResponse.json(info);
}



