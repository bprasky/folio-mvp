export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectWrite } from "@/lib/authz/access";
import { BlocksSchema } from "@/lib/posting/schemas";
import { preservePresentation } from '@/lib/story/presentation';
import { Prisma } from '@prisma/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;

    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (e: any) {
      if (e.message === "NotFound") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate input
    const body = await request.json();
    const validated = BlocksSchema.parse(body);

    // Full prose saves do not own presentation. Keep the saved choice even when
    // an older editor submits a whole article without it (or with a stale copy).
    const current = await prisma.projectPost.findUnique({ where: { projectId } });
    if (!current) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    const expandedBlocks = preservePresentation(validated, current.expandedBlocks);
    const saved = await prisma.projectPost.updateMany({
      where: { id: current.id, updatedAt: current.updatedAt },
      data: {
        expandedBlocks: expandedBlocks as Prisma.InputJsonValue,
      },
    });
    if (!saved.count) return NextResponse.json({ error: 'The article changed. Refresh and try again.' }, { status: 409 });
    const post = { ...current, expandedBlocks };

    return NextResponse.json({ ok: true, post });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", issues: error.errors },
        { status: 400 }
      );
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[posting/blocks] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


