import { Router, Request, Response } from 'express';
import { prisma } from '../prisma/client.js';
import { ConversationManager } from '../conversation/manager.js';
import { config } from '../config.js';

const router = Router();

// Active session managers
const activeSessions = new Map<string, ConversationManager>();

/**
 * Prepare a new interview session
 * Called by the main Next.js app after creating the session in DB
 */
router.post('/prepare', async (req: Request, res: Response) => {
  try {
    const { sessionId, projectId, roomName } = req.body;

    if (!sessionId || !projectId || !roomName) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Verify session exists
    const session = await prisma.realtimeInterviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Create conversation manager (will be started when designer connects)
    const manager = new ConversationManager({
      sessionId,
      projectId,
      roomName,
      onStateChange: (state) => {
        console.log(`Session ${sessionId} state: ${state}`);
      },
      onExtraction: (extraction) => {
        console.log(`Session ${sessionId} extraction:`, extraction);
      },
    });

    activeSessions.set(sessionId, manager);

    // Start the session (connects to LiveKit and waits for designer)
    manager.start().catch((error) => {
      console.error(`Failed to start session ${sessionId}:`, error);
      activeSessions.delete(sessionId);
    });

    res.json({ ok: true, sessionId });
  } catch (error) {
    console.error('Failed to prepare session:', error);
    res.status(500).json({ error: 'Failed to prepare session' });
  }
});

/**
 * Get session status
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.realtimeInterviewSession.findUnique({
      where: { id: sessionId },
      include: {
        segments: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const manager = activeSessions.get(sessionId);

    res.json({
      ...session,
      isActive: !!manager,
      currentState: manager?.getState() || null,
    });
  } catch (error) {
    console.error('Failed to get session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * Pause a session
 */
router.post('/:sessionId/pause', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const manager = activeSessions.get(sessionId);

    if (!manager) {
      res.status(404).json({ error: 'Session not active' });
      return;
    }

    manager.pause();

    await prisma.realtimeInterviewSession.update({
      where: { id: sessionId },
      data: { status: 'PAUSED' },
    });

    res.json({ ok: true, state: 'paused' });
  } catch (error) {
    console.error('Failed to pause session:', error);
    res.status(500).json({ error: 'Failed to pause session' });
  }
});

/**
 * Resume a session
 */
router.post('/:sessionId/resume', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const manager = activeSessions.get(sessionId);

    if (!manager) {
      res.status(404).json({ error: 'Session not active' });
      return;
    }

    manager.resume();

    await prisma.realtimeInterviewSession.update({
      where: { id: sessionId },
      data: { status: 'ACTIVE' },
    });

    res.json({ ok: true, state: 'listening' });
  } catch (error) {
    console.error('Failed to resume session:', error);
    res.status(500).json({ error: 'Failed to resume session' });
  }
});

/**
 * End a session
 */
router.post('/:sessionId/end', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const manager = activeSessions.get(sessionId);

    if (manager) {
      await manager.stop();
      activeSessions.delete(sessionId);
    }

    res.json({ ok: true, state: 'ended' });
  } catch (error) {
    console.error('Failed to end session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

/**
 * Clean up abandoned sessions
 */
router.post('/cleanup', async (_req: Request, res: Response) => {
  try {
    // Find sessions that have been active for too long
    const maxDuration = config.limits.maxDurationMs;
    const cutoff = new Date(Date.now() - maxDuration);

    const abandonedSessions = await prisma.realtimeInterviewSession.findMany({
      where: {
        status: 'ACTIVE',
        startedAt: { lt: cutoff },
      },
    });

    for (const session of abandonedSessions) {
      const manager = activeSessions.get(session.id);
      if (manager) {
        await manager.stop();
        activeSessions.delete(session.id);
      }

      await prisma.realtimeInterviewSession.update({
        where: { id: session.id },
        data: {
          status: 'ABANDONED',
          endedAt: new Date(),
        },
      });
    }

    res.json({ ok: true, cleaned: abandonedSessions.length });
  } catch (error) {
    console.error('Failed to cleanup sessions:', error);
    res.status(500).json({ error: 'Failed to cleanup sessions' });
  }
});

export default router;
