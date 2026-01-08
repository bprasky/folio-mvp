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
        OPENAI_ENABLED: process.env.OPENAI_ENABLED ?? 'unset',
        OPENAI_API_KEY: redacted(process.env.OPENAI_API_KEY),
        OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'default',
      },
      tips: [
        'If OPENAI_ENABLED is "false" or key is unset → followups/generate will fallback.',
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


