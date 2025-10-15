import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.redirect(new URL("/vendor/dashboard", req.url));

  const form = await req.formData();
  const orgId = String(form.get("view_as_org") ?? "").trim();

  if (!orgId) return NextResponse.redirect(new URL("/vendor/dashboard", req.url));

  // only set cookie if user actually belongs to this org
  const membership = await prisma.organizationUser.findFirst({
    where: { userId: session.user.id, organizationId: orgId, isActive: true },
    select: { organizationId: true },
  });
  if (!membership) return NextResponse.redirect(new URL("/vendor/dashboard", req.url));

  const res = NextResponse.redirect(new URL("/vendor/dashboard", req.url));
  res.cookies.set("view_as_org", orgId, { path: "/", httpOnly: false, sameSite: "lax" });
  return res;
}



