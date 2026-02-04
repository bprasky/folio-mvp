export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { realtimeInterviewConfig } from '@/lib/flags';

/**
 * POST /api/interview/realtime/session
 * Create a new realtime interview session
 */
export async function POST(req: NextRequest) {
  try {
    // Check feature flag
    if (!realtimeInterviewConfig.enabled) {
      return NextResponse.json(
        { error: 'Realtime interview is not enabled' },
        { status: 403 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { designerId: session.user.id },
          { ownerId: session.user.id },
        ],
      },
      include: {
        designer: {
          select: { id: true, name: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check for existing active session
    const existingSession = await prisma.realtimeInterviewSession.findFirst({
      where: {
        projectId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
    });

    if (existingSession) {
      return NextResponse.json(
        {
          error: 'An active session already exists for this project',
          sessionId: existingSession.id,
        },
        { status: 409 }
      );
    }

    // Create unique room name
    const roomName = `interview-${projectId}-${Date.now()}`;

    // Create session in database
    const realtimeSession = await prisma.realtimeInterviewSession.create({
      data: {
        projectId,
        livekitRoomName: roomName,
        status: 'ACTIVE',
        projectContext: {
          projectName: project.title || 'Untitled Project',
          designerName: project.designer?.name || 'Designer',
        },
      },
    });

    // Generate LiveKit token for client
    // Note: In production, you would use the LiveKit server SDK here
    // For now, we'll call the orchestration service which has the SDK
    const orchestrationUrl = process.env.ORCHESTRATION_SERVICE_URL;
    const orchestrationSecret = process.env.ORCHESTRATION_SERVICE_SECRET;

    if (orchestrationUrl && orchestrationSecret) {
      try {
        await fetch(`${orchestrationUrl}/session/prepare`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${orchestrationSecret}`,
          },
          body: JSON.stringify({
            sessionId: realtimeSession.id,
            projectId,
            roomName,
          }),
        });
      } catch (error) {
        console.error('Failed to notify orchestration service:', error);
        // Continue anyway - the session is created, orchestration can catch up
      }
    }

    // Generate a simple token for the client
    // In production, this would be a proper LiveKit token
    const token = Buffer.from(
      JSON.stringify({
        sessionId: realtimeSession.id,
        userId: session.user.id,
        roomName,
        exp: Date.now() + realtimeInterviewConfig.maxDurationMs,
      })
    ).toString('base64');

    return NextResponse.json({
      sessionId: realtimeSession.id,
      roomName,
      token,
      livekitUrl: process.env.LIVEKIT_URL || '',
      maxDurationMs: realtimeInterviewConfig.maxDurationMs,
    });
  } catch (error) {
    console.error('Failed to create realtime session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/interview/realtime/session?sessionId=xxx
 * Get session status and data
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = req.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const realtimeSession = await prisma.realtimeInterviewSession.findUnique({
      where: { id: sessionId },
      include: {
        segments: {
          orderBy: { sequenceNumber: 'asc' },
        },
        project: {
          select: {
            id: true,
            title: true,
            designerId: true,
            ownerId: true,
          },
        },
      },
    });

    if (!realtimeSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify access
    const hasAccess =
      realtimeSession.project.designerId === session.user.id ||
      realtimeSession.project.ownerId === session.user.id;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(realtimeSession);
  } catch (error) {
    console.error('Failed to get session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}
