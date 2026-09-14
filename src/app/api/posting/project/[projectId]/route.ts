import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView, assertProjectWrite } from "@/lib/authz/access";
import { stripPrivateInterviewData } from '@/lib/spotlight/privacy';
import { publicFolioBlocks } from '@/lib/posting/publicFolioBlocks';

export const dynamic = 'force-dynamic'; // Prevent caching of draft data

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

    // Fetch post
    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      include: {
        project: {
          include: {
            designer: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                bio: true,
                studio: true,
              },
            },
            images: {
              include: {
                tags: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    // Shared viewers receive display copy; only editors receive rewrite evidence.
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Forbidden') throw error;
      post.expandedBlocks = publicFolioBlocks(post.expandedBlocks);
    }
    return NextResponse.json({ post: await stripPrivateInterviewData(post) });
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[posting/[projectId]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

