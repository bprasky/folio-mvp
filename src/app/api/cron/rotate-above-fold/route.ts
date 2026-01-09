// src/app/api/cron/rotate-above-fold/route.ts
//
// Cron Job: Rotate Above Fold Content
//
// This endpoint should be called periodically (e.g., hourly) to:
// 1. Rotate expired content out of the above-fold position
// 2. Calculate and assign badges based on engagement
// 3. Flag high performers for edition inclusion
//
// Usage with Vercel Cron:
// Add to vercel.json:
// {
//   "crons": [
//     {
//       "path": "/api/cron/rotate-above-fold",
//       "schedule": "0 * * * *"  // Every hour
//     }
//   ]
// }
//
// Or use an external cron service to call this endpoint

import { NextRequest, NextResponse } from "next/server";
import { rotateAboveFold } from "@/lib/editorial/aboveFold";

// Vercel cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (if configured)
    if (CRON_SECRET) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        console.warn("[CRON] Unauthorized rotate-above-fold attempt");
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    console.log("[CRON] Starting above-fold rotation...");
    const startTime = Date.now();

    const result = await rotateAboveFold();

    const duration = Date.now() - startTime;
    console.log(
      `[CRON] Above-fold rotation complete in ${duration}ms:`,
      JSON.stringify(result)
    );

    return NextResponse.json({
      success: true,
      data: result,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Error rotating above-fold:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
