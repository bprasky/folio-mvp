import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import sessionRoutes from './routes/session.js';
import healthRoutes from './routes/health.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Auth middleware for protected routes
const authMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (token !== config.security.serviceSecret) {
    res.status(403).json({ error: 'Invalid service secret' });
    return;
  }

  next();
};

// Routes
app.use('/health', healthRoutes);
app.use('/session', authMiddleware, sessionRoutes);

// Error handler
app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: config.nodeEnv === 'development' ? error.message : undefined,
    });
  }
);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Interview orchestration service running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
