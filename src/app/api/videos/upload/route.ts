import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Mock OpenAI integration - replace with actual OpenAI API calls
const mockTranscribeVideo = async (videoUrl: string): Promise<{
  transcript: string;
  pullQuotes: { timestamp: number; text: string; }[];
  mentionedProducts: string[];
  mentionedVendors: string[];
}> => {
  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock response - in production, this would call OpenAI Whisper API
  return {
    transcript: "In this video, I'm showcasing the beautiful Herman Miller Aeron chair in our latest project. The sustainable materials and ergonomic design make it perfect for modern workspaces. We also incorporated lighting from West Elm and textiles from Coyuchi to create a cohesive, eco-friendly environment.",
    pullQuotes: [
      { timestamp: 15, text: "The Herman Miller Aeron chair represents the perfect blend of form and function" },
      { timestamp: 45, text: "Sustainable materials are the foundation of responsible design" },
      { timestamp: 78, text: "West Elm lighting creates the perfect ambiance for any space" }
    ],
    mentionedProducts: ["Herman Miller Aeron Chair", "West Elm Pendant Light", "Coyuchi Organic Throw"],
    mentionedVendors: ["Herman Miller", "West Elm", "Coyuchi"]
  };
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('video') as File;
    const videoUrl = formData.get('videoUrl') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const creatorId = formData.get('creatorId') as string;
    const creatorType = formData.get('creatorType') as string; // 'designer' or 'vendor'
    const relatedProjectId = formData.get('relatedProjectId') as string;
    const tags = formData.get('tags') as string;
    const isPublic = formData.get('isPublic') === 'true';

    let finalVideoUrl = videoUrl;

    // Handle file upload if provided
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create uploads directory if it doesn't exist
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'videos');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      const filepath = join(uploadsDir, filename);

      await writeFile(filepath, buffer);
      finalVideoUrl = `/uploads/videos/${filename}`;
    }

    // Generate unique video ID
    const videoId = `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create video object
    const video = {
      id: videoId,
      title: title || 'Untitled Video',
      description: description || '',
      videoUrl: finalVideoUrl,
      creatorId,
      creatorType,
      relatedProjectId: relatedProjectId || null,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      isPublic,
      transcript: '',
      pullQuotes: [],
      mentionedProducts: [],
      mentionedVendors: [],
      views: 0,
      likes: 0,
      clips: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      transcriptionStatus: 'processing'
    };

    // Start AI transcription process (async)
    transcribeVideoAsync(videoId, finalVideoUrl);

    // Save video to JSON file (in production, use database)
    const videosPath = join(process.cwd(), 'data', 'videos.json');
    let videos = [];
    
    try {
      const videosContent = await readFile(videosPath, 'utf-8');
      videos = JSON.parse(videosContent);
    } catch (error) {
      // File doesn't exist yet, start with empty array
      videos = [];
    }

    videos.push(video);

    // Write updated videos array
    await writeFile(videosPath, JSON.stringify(videos, null, 2));

    return NextResponse.json({ 
      success: true, 
      video,
      message: 'Video uploaded successfully. Transcription in progress...' 
    });

  } catch (error) {
    console.error('Video upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload video' },
      { status: 500 }
    );
  }
}

// Async function to handle transcription
async function transcribeVideoAsync(videoId: string, videoUrl: string) {
  try {
    // Perform AI transcription
    const transcriptionResult = await mockTranscribeVideo(videoUrl);

    // Update video with transcription results
    const videosPath = join(process.cwd(), 'data', 'videos.json');
    let videos = [];
    
    try {
      const videosContent = await readFile(videosPath, 'utf-8');
      videos = JSON.parse(videosContent);
    } catch (error) {
      console.error('Error loading videos for transcription update:', error);
      return;
    }

    // Find and update the video
    const videoIndex = videos.findIndex((v: any) => v.id === videoId);
    if (videoIndex !== -1) {
      videos[videoIndex] = {
        ...videos[videoIndex],
        transcript: transcriptionResult.transcript,
        pullQuotes: transcriptionResult.pullQuotes,
        mentionedProducts: transcriptionResult.mentionedProducts,
        mentionedVendors: transcriptionResult.mentionedVendors,
        transcriptionStatus: 'completed',
        updatedAt: new Date().toISOString()
      };

      // Save updated videos
      await writeFile(videosPath, JSON.stringify(videos, null, 2));
      console.log(`Transcription completed for video ${videoId}`);
    }

  } catch (error) {
    console.error('Transcription error:', error);
    
    // Mark transcription as failed
    try {
      const videosPath = join(process.cwd(), 'data', 'videos.json');
      const videosContent = await readFile(videosPath, 'utf-8');
      const videos = JSON.parse(videosContent);
      
      const videoIndex = videos.findIndex((v: any) => v.id === videoId);
      if (videoIndex !== -1) {
        videos[videoIndex].transcriptionStatus = 'failed';
        await writeFile(videosPath, JSON.stringify(videos, null, 2));
      }
    } catch (updateError) {
      console.error('Error updating transcription status:', updateError);
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creatorId');
    const creatorType = searchParams.get('creatorType');
    const isPublic = searchParams.get('public');
    const relatedProjectId = searchParams.get('projectId');

    // Load videos from JSON file
    const videosPath = join(process.cwd(), 'data', 'videos.json');
    let videos = [];
    
    try {
      const videosContent = await readFile(videosPath, 'utf-8');
      videos = JSON.parse(videosContent);
    } catch (error) {
      // File doesn't exist yet
      videos = [];
    }

    // Filter videos based on query parameters
    let filteredVideos = videos;

    if (creatorId) {
      filteredVideos = filteredVideos.filter((video: any) => video.creatorId === creatorId);
    }

    if (creatorType) {
      filteredVideos = filteredVideos.filter((video: any) => video.creatorType === creatorType);
    }

    if (isPublic === 'true') {
      filteredVideos = filteredVideos.filter((video: any) => video.isPublic === true);
    }

    if (relatedProjectId) {
      filteredVideos = filteredVideos.filter((video: any) => video.relatedProjectId === relatedProjectId);
    }

    // Sort by creation date (newest first)
    filteredVideos.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, videos: filteredVideos });

  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
} 