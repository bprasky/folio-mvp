import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasNewProductsSinceGeneration } from "@/lib/posting/hasNewProductsSinceGeneration";
import { assertProjectView } from "@/lib/authz/access";

export const dynamic = 'force-dynamic';

/**
 * GET /api/posting/project/[projectId]/new-products
 *
 * Check if new ProductTags have been added since the last post generation.
 * Used to prompt designers to regenerate their post after importing PDF specs.
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

    const result = await hasNewProductsSinceGeneration(projectId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[new-products] Error:", error);

    if (error.message?.includes("Access denied") || error.message?.includes("not found")) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to check new products" },
      { status: 500 }
    );
  }
}
