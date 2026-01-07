import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VendorAnalytics } from "@/lib/analytics";

type Params = { params: { visitId: string } };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await req.json();
    const visit = await prisma.vendorVisit.findUnique({ 
      where: { id: params.visitId } 
    });
    
    if (!visit || visit.vendorId !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    const updated = await prisma.vendorVisit.update({
      where: { id: params.visitId },
      data: { projectId },
    });

    await VendorAnalytics.visitAttachedProject(session.user.id, updated.id, projectId);
    return NextResponse.json({ visit: updated });
  } catch (error) {
    console.error("Error attaching project to visit:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
