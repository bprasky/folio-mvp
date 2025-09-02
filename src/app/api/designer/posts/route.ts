import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { PrismaClient } from '@prisma/client';
import { generateAffiliateUrl } from '@/lib/urls';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { title, content, folderId, affiliate, items } = await request.json();

    if (!title || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Title and items are required' }, { status: 400 });
    }

    // Verify folder exists and user has access
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: folderId,
          designerId: userId,
        },
      });

      if (!folder) {
        return NextResponse.json({ error: 'Folder not found or access denied' }, { status: 404 });
      }
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        title: title.trim(),
        content: content?.trim() || null,
        designerId: userId,
        folderId: folderId || null,
      },
    });

    // Create post items with affiliate URLs
    const postItems = await Promise.all(
      items.map(async (item: any) => {
        let affiliateUrl = null;
        
        if (affiliate && item.baseUrl) {
          affiliateUrl = generateAffiliateUrl(item.baseUrl, userId, title);
        }

        return prisma.postItem.create({
          data: {
            postId: post.id,
            productName: item.productName,
            imageUrl: item.imageUrl,
            affiliateUrl,
            section: item.section || null,
          },
        });
      })
    );

    return NextResponse.json({ 
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        createdAt: post.createdAt,
        items: postItems,
      }
    });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
