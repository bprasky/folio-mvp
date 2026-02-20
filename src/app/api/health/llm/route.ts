export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

export async function GET() {
  // Match generator logic: key must exist AND ANTHROPIC_ENABLED !== "false"
  const enabled = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";

  return NextResponse.json({
    ok: enabled,
    provider: "anthropic",
    features: enabled ? ["editorial_draft_v1"] : [],
    reason: enabled
      ? undefined
      : !process.env.ANTHROPIC_API_KEY
      ? "missing_api_key"
      : "disabled",
  });
}

