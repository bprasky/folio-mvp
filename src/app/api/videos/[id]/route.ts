// @idor-allow: public-read reason="Public video detail viewable anonymously; PUT/DELETE mutations require session auth"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const videoId = params.id;

    // Load videos from JSON file
    const videosPath = join(process.cwd(), 'src', 'data', 'videos.json');
    const videosContent = await readFile(videosPath, 'utf-8');
    const videos = JSON.parse(videosContent);

    // Find the video
    const video = videos.find((v: any) => v.id === videoId);
    if (!video) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    // Increment view count
    video.views = (video.views || 0) + 1;
    video.updatedAt = new Date().toISOString();

    // Update video in the array
    const videoIndex = videos.findIndex((v: any) => v.id === videoId);
    videos[videoIndex] = video;

    // Save updated videos
    await writeFile(videosPath, JSON.stringify(videos, null, 2));

    return NextResponse.json({ success: true, video });

  } catch (error) {
    console.error('Get video error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch video' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const videoId = params.id;
    const updates = await request.json();

    // Load videos from JSON file
    const videosPath = join(process.cwd(), 'src', 'data', 'videos.json');
    const videosContent = await readFile(videosPath, 'utf-8');
    const videos = JSON.parse(videosContent);

    // Find the video
    const videoIndex = videos.findIndex((v: any) => v.id === videoId);
    if (videoIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    // Only the owner may update the video.
    if (videos[videoIndex].ownerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Update video with provided fields; ownerId is immutable.
    const { ownerId: _ignoredOwnerId, ...safeUpdates } = updates ?? {};
    videos[videoIndex] = {
      ...videos[videoIndex],
      ...safeUpdates,
      updatedAt: new Date().toISOString()
    };

    // Save updated videos
    await writeFile(videosPath, JSON.stringify(videos, null, 2));

    return NextResponse.json({ 
      success: true, 
      video: videos[videoIndex],
      message: 'Video updated successfully' 
    });

  } catch (error) {
    console.error('Update video error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update video' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const videoId = params.id;

    // Load videos from JSON file
    const videosPath = join(process.cwd(), 'src', 'data', 'videos.json');
    const videosContent = await readFile(videosPath, 'utf-8');
    const videos = JSON.parse(videosContent);

    // Find the video index
    const videoIndex = videos.findIndex((v: any) => v.id === videoId);
    if (videoIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    // Only the owner may delete the video.
    if (videos[videoIndex].ownerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Remove video from array
    const deletedVideo = videos.splice(videoIndex, 1)[0];

    // Save updated videos
    await writeFile(videosPath, JSON.stringify(videos, null, 2));

    return NextResponse.json({ 
      success: true, 
      message: 'Video deleted successfully',
      deletedVideo 
    });

  } catch (error) {
    console.error('Delete video error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete video' },
      { status: 500 }
    );
  }
} 