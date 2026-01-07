import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId, projectId, roomId, eventId, subeventId, userId } = await req.json();

    if (!productId || !projectId || !roomId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch product details used to denormalize into Selection
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, imageUrl: true, brand: true, vendorId: true, price: true },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Create the Selection the board already reads
    const selection = await prisma.selection.create({
      data: {
        productName: product.name ?? "Untitled product",
        vendorName: product.brand ?? "Unknown vendor",
        photo: product.imageUrl ?? "",
        unitPrice: product.price ?? 0,
        projectId,
        roomId,
        notes: eventId ? `Saved from event ${eventId}` : null,
        // Store structured linkage in uiMeta JSON
        uiMeta: {
          productId: product.id,
          vendorId: product.vendorId ?? null,
          eventId: eventId ?? null,
          subeventId: subeventId ?? null,
          savedBy: userId ?? session.user.id,
          source: "festival_modal",
          ts: new Date().toISOString(),
        },
      },
    });

    // Make it show up immediately
    revalidatePath(`/project/${projectId}`);

    return NextResponse.json({
      ok: true,
      selection: {
        id: selection.id,
        projectId: selection.projectId,
        roomId: selection.roomId,
        productName: selection.productName,
      },
    });
  } catch (err) {
    console.error("save-to-room error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}