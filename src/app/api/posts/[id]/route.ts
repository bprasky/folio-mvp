import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const postId = params.id;

    // Fetch post with designer and items
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Error fetching post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
