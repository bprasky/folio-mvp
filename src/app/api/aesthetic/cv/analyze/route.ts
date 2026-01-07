import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { analyzeImage } from "@/lib/aesthetic";

/**
 * POST /api/aesthetic/cv/analyze
 * 
 * Analyzes an image and returns image signals.
 * Currently stubbed - will integrate with CV service later.
 * 
 * Body: { imageUrl: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    // Analyze image (currently stubbed)
    const signals = await analyzeImage(imageUrl);

    return NextResponse.json(signals);
  } catch (error: any) {
    console.error("[aesthetic/cv/analyze] Error:", error);
    return NextResponse.json(
      { error: "Failed to analyze image", message: error.message },
      { status: 500 }
    );
  }
}


