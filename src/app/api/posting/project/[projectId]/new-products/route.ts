import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { assertProjectView } from "@/lib/authz/access";
import { hasNewProductsSinceGeneration } from "@/lib/posting/hasNewProductsSinceGeneration";

export const dynamic = 'force-dynamic';

/**
 * GET /api/posting/project/[projectId]/new-products
 *
 * Returns information about products tagged since the last post generation.
 * Used to prompt designers to regenerate their editorial post after importing new products.
 *
 * Response:
 * {
 *   hasNew: boolean,
 *   newCount: number,
 *   newestProductAt: string | null,  // ISO date string
 *   lastGeneratedAt: string | null   // ISO date string
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;

    // Check project access
    await assertProjectView(session.user.id, projectId);

    // Get new products info
    const result = await hasNewProductsSinceGeneration(projectId);

    return NextResponse.json({
      hasNew: result.hasNew,
      newCount: result.newCount,
      newestProductAt: result.newestProductAt?.toISOString() ?? null,
      lastGeneratedAt: result.lastGeneratedAt?.toISOString() ?? null,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[posting/new-products] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
