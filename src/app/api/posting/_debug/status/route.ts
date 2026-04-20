// @idor-allow: public-read reason="Dev-only debug status; ensureDev() throws in production"
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ensureDev, redacted } from '@/lib/utils/devGuards';

export async function GET() {
  try {
    ensureDev();

    const out = {
      ok: true,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        POSTING_V1: process.env.POSTING_V1,
        ANTHROPIC_ENABLED: process.env.ANTHROPIC_ENABLED ?? 'unset',
        ANTHROPIC_API_KEY: redacted(process.env.ANTHROPIC_API_KEY),
        OPENAI_API_KEY: redacted(process.env.OPENAI_API_KEY),
      },
      tips: [
        'If ANTHROPIC_ENABLED is "false" or key is unset → followups/generate will fallback.',
        'OPENAI_API_KEY still needed for embeddings, Whisper transcription, and moderation.',
        'If rate-limited → expect 429 classification and backoff logs.',
        'Moderation issues classify as "moderation_block" (422)',
      ],
    };
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'failed' },
      { status: e?.status ?? 500 }
    );
  }
}


