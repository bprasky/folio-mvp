import { Router, Request, Response } from 'express';
import { prisma } from '../prisma/client.js';

const router = Router();

/**
 * Basic health check
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'interview-orchestration',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Detailed health check with dependencies
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Check database
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check if all required env vars are present
  const requiredEnvVars = [
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'LIVEKIT_URL',
    'DEEPGRAM_API_KEY',
    'CARTESIA_API_KEY',
    'ANTHROPIC_API_KEY',
  ];

  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
  checks.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
    error: missingEnvVars.length > 0 ? `Missing: ${missingEnvVars.join(', ')}` : undefined,
  };

  const isHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Liveness probe (for k8s)
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json({ status: 'alive' });
});

export default router;
