import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  generateWeeklyEdition,
  generateMonthlyEdition,
  generateQuarterlyEdition,
  generateAnnualEdition,
} from "@/lib/editorial/editions";
import {
  runScheduledEditionJobs,
  forceGenerateAllEditions,
} from "@/lib/editorial/scheduler";

// [Edition System] Trigger edition generation (admin only)

type CadenceType = "weekly" | "monthly" | "quarterly" | "annual" | "scheduled" | "all";

const CADENCE_GENERATORS: Record<string, (date: Date) => Promise<unknown>> = {
  weekly: generateWeeklyEdition,
  monthly: generateMonthlyEdition,
  quarterly: generateQuarterlyEdition,
  annual: generateAnnualEdition,
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const cadence = (body.cadence ?? "scheduled") as CadenceType;
    const referenceDate = body.referenceDate ? new Date(body.referenceDate) : new Date();

    // Validate reference date
    if (isNaN(referenceDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid reference date" },
        { status: 400 }
      );
    }

    let result: unknown;

    if (cadence === "scheduled") {
      // Run whatever jobs are scheduled for today
      result = await runScheduledEditionJobs();
    } else if (cadence === "all") {
      // Force generate all edition types
      result = await forceGenerateAllEditions(referenceDate);
    } else if (CADENCE_GENERATORS[cadence]) {
      // Generate specific cadence
      result = await CADENCE_GENERATORS[cadence](referenceDate);
    } else {
      return NextResponse.json(
        { error: `Invalid cadence: ${cadence}. Must be one of: weekly, monthly, quarterly, annual, scheduled, all` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      cadence,
      referenceDate: referenceDate.toISOString(),
      result,
    });
  } catch (error) {
    console.error("[API] POST /api/editions/generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate edition" },
      { status: 500 }
    );
  }
}
