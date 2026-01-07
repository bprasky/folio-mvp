import { NextResponse } from "next/server";

export async function GET() {
  // Match generator logic: key must exist AND OPENAI_ENABLED !== "false"
  const enabled = !!process.env.OPENAI_API_KEY && process.env.OPENAI_ENABLED !== "false";

  return NextResponse.json({
    ok: enabled,
    provider: "openai",
    features: enabled ? ["editorial_draft_v1"] : [],
    reason: enabled
      ? undefined
      : !process.env.OPENAI_API_KEY
      ? "missing_api_key"
      : "disabled",
  });
}

