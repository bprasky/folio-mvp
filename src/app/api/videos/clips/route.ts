import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, startTime, endTime, title, description } = body;

    if (!videoId || startTime === undefined || endTime === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Load videos from JSON file
    const videosPath = join(process.cwd(), 'data', 'videos.json');
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

    // Create clip object
    const clipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const clip = {
      id: clipId,
      videoId,
      title: title || `Clip from ${video.title}`,
      description: description || '',
      startTime,
      endTime,
      duration: endTime - startTime,
      createdAt: new Date().toISOString(),
      views: 0,
      likes: 0
    };

    // Add clip to video
    if (!video.clips) {
      video.clips = [];
    }
    video.clips.push(clip);

    // Update video in the array
    const videoIndex = videos.findIndex((v: any) => v.id === videoId);
    videos[videoIndex] = video;

    // Save updated videos
    await writeFile(videosPath, JSON.stringify(videos, null, 2));

    return NextResponse.json({ 
      success: true, 
      clip,
      message: 'Clip created successfully' 
    });

  } catch (error) {
    console.error('Create clip error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create clip' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    // Load videos from JSON file
    const videosPath = join(process.cwd(), 'data', 'videos.json');
    let videos = [];
    try {
      const videosContent = await readFile(videosPath, 'utf-8');
      videos = JSON.parse(videosContent);
    } catch (error) {
      videos = [];
    }

    if (videoId) {
      // Get clips for specific video
      const video = videos.find((v: any) => v.id === videoId);
      if (!video) {
        return NextResponse.json(
          { success: false, error: 'Video not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        clips: video.clips || [] 
      });
    } else {
      // Get all clips from all videos
      const allClips = videos.reduce((clips: any[], video: any) => {
        if (video.clips && video.clips.length > 0) {
          const videoClips = video.clips.map((clip: any) => ({
            ...clip,
            videoTitle: video.title,
            creatorId: video.creatorId,
            creatorType: video.creatorType
          }));
          clips.push(...videoClips);
        }
        return clips;
      }, []);

      // Sort by creation date (newest first)
      allClips.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return NextResponse.json({ 
        success: true, 
        clips: allClips 
      });
    }

  } catch (error) {
    console.error('Get clips error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch clips' },
      { status: 500 }
    );
  }
} 