import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string(),

  // LiveKit
  LIVEKIT_API_KEY: z.string(),
  LIVEKIT_API_SECRET: z.string(),
  LIVEKIT_URL: z.string(),

  // Deepgram
  DEEPGRAM_API_KEY: z.string(),

  // Cartesia
  CARTESIA_API_KEY: z.string(),
  CARTESIA_VOICE_ID: z.string().default('sofia-editorial'),

  // Anthropic
  ANTHROPIC_API_KEY: z.string(),

  // Security
  ORCHESTRATION_SERVICE_SECRET: z.string(),

  // Limits
  REALTIME_INTERVIEW_MAX_DURATION_MS: z.string().default('1800000'),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment configuration:');
    console.error(parsed.error.format());
    throw new Error('Invalid environment configuration');
  }

  return {
    port: parseInt(parsed.data.PORT, 10),
    nodeEnv: parsed.data.NODE_ENV,
    database: {
      url: parsed.data.DATABASE_URL,
    },
    livekit: {
      apiKey: parsed.data.LIVEKIT_API_KEY,
      apiSecret: parsed.data.LIVEKIT_API_SECRET,
      url: parsed.data.LIVEKIT_URL,
    },
    deepgram: {
      apiKey: parsed.data.DEEPGRAM_API_KEY,
    },
    cartesia: {
      apiKey: parsed.data.CARTESIA_API_KEY,
      voiceId: parsed.data.CARTESIA_VOICE_ID,
    },
    anthropic: {
      apiKey: parsed.data.ANTHROPIC_API_KEY,
    },
    security: {
      serviceSecret: parsed.data.ORCHESTRATION_SERVICE_SECRET,
    },
    limits: {
      maxDurationMs: parseInt(parsed.data.REALTIME_INTERVIEW_MAX_DURATION_MS, 10),
    },
  };
}

export const config = loadConfig();
export type Config = ReturnType<typeof loadConfig>;
