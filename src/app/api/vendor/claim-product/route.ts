export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // Require authenticated session alongside token verification
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { previewTokenId, vendorName, vendorEmail, website } = body;

    if (!previewTokenId || !vendorEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const previewToken = await prisma.vendorPreviewToken.findUnique({
      where: { id: previewTokenId },
      include: { product: true, vendor: true },
    });

    if (!previewToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    // Check if token is expired
    if (previewToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token has expired" }, { status: 410 });
    }

    // Find or create vendor
    let vendor = previewToken.vendor;

    if (!vendor) {
      // Try to find existing vendor by email
      const existingVendor = await prisma.vendor.findUnique({
        where: { primaryEmail: vendorEmail },
      });

      if (existingVendor) {
        vendor = existingVendor;
      } else {
        // Create new vendor
        vendor = await prisma.vendor.create({
          data: {
            name: vendorName || "New Vendor",
            primaryEmail: vendorEmail,
            website: website || null,
          },
        });
      }

      // Attach vendor to token
      await prisma.vendorPreviewToken.update({
        where: { id: previewTokenId },
        data: { vendorId: vendor.id },
      });
    } else {
      // Update vendor info if provided
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: {
          name: vendorName || vendor.name,
          website: website || vendor.website,
        },
      });
    }

    // Attach vendor to product if not already
    if (!previewToken.product.vendorRecordId) {
      await prisma.product.update({
        where: { id: previewToken.productId },
        data: {
          vendorRecordId: vendor.id,
          status: "active",
        },
      });
    }

    // Mark token as used
    await prisma.vendorPreviewToken.update({
      where: { id: previewTokenId },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({ ok: true, vendorId: vendor.id });
  } catch (error: any) {
    console.error("Error claiming product:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}




