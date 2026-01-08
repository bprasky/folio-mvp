export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { saveBufferToProjectStorage } from '@/lib/storage';
import { indexMoment } from '@/lib/search/indexMoment';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const userId = session.user.id;

    // Check project access
    await assertProjectView(userId, projectId);

    const body = await request.json();
    let { url, name, room } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Check if URL is external (not Supabase) and needs to be re-uploaded
    const isExternalUrl = !url.includes(process.env.NEXT_PUBLIC_SUPABASE_URL || '') && 
                         (url.startsWith('http://') || url.startsWith('https://'));
    
    // Re-upload external images to Supabase to avoid CDN restrictions
    if (isExternalUrl) {
      try {
        console.log(`[POST /api/projects/[id]/images] Re-uploading external image to Supabase: ${url.substring(0, 100)}...`);
        
        // Fetch the image
        const imageResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': url.split('/').slice(0, 3).join('/') + '/',
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!imageResponse.ok) {
          // If fetch fails, try without Referer
          const retryResponse = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(30000),
          });
          
          if (!retryResponse.ok) {
            console.warn(`[POST /api/projects/[id]/images] Failed to fetch external image, storing original URL: ${retryResponse.status}`);
            // Fall through to store original URL
          } else {
            const arrayBuffer = await retryResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = retryResponse.headers.get('content-type') || 'image/jpeg';
            
            // Upload to Supabase
            const { publicUrl } = await saveBufferToProjectStorage({
              projectId,
              roomId: room || 'default',
              buffer,
              mime: contentType,
            });
            
            url = publicUrl;
            console.log(`[POST /api/projects/[id]/images] Successfully re-uploaded to Supabase: ${url}`);
          }
        } else {
          const arrayBuffer = await imageResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          
          // Upload to Supabase
          const { publicUrl } = await saveBufferToProjectStorage({
            projectId,
            roomId: room || 'default',
            buffer,
            mime: contentType,
          });
          
          url = publicUrl;
          console.log(`[POST /api/projects/[id]/images] Successfully re-uploaded to Supabase: ${url}`);
        }
      } catch (error: any) {
        console.warn(`[POST /api/projects/[id]/images] Failed to re-upload external image, storing original URL:`, error.message);
        // Fall through to store original URL - better than failing completely
      }
    }

    // Create ProjectImage record
    const image = await prisma.projectImage.create({
      data: {
        url,
        name: name || null,
        room: room || null,
        projectId,
      },
      include: {
        tags: {
          include: {
            product: true,
          },
        },
      },
    });

    // Index the moment for search (async, don't block response)
    indexMoment(image.id).catch(err => {
      console.error(`[POST /api/projects/[id]/images] Failed to index moment ${image.id}:`, err);
      // Don't fail the upload if indexing fails
    });

    return NextResponse.json({ 
      success: true, 
      image 
    }, { status: 201 });

  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[POST /api/projects/[id]/images] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}


