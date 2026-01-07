import { NextRequest, NextResponse } from "next/server";
import { recomputeDesignerAtelierFingerprint } from "@/lib/atelier/aggregate";
import { requireAdmin } from "@/lib/requireAdmin";

type Params = { params: { designerId: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { designerId } = params;

    const fp = await recomputeDesignerAtelierFingerprint(designerId);

    return NextResponse.json({ success: true, fingerprint: fp });
  } catch (error: any) {
    console.error("Error recomputing Atelier fingerprint:", error);
    return NextResponse.json(
      { 
        error: error?.message || "Failed to recompute fingerprint",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}




