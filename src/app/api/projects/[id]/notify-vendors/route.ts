export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertProjectWrite } from "@/lib/authz/access";
import { sendVendorProductPreviewEmail } from "@/lib/email/sendVendorProductPreviewEmail";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

interface Params {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = params;

    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (e: any) {
      if (e.message === "NotFound") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Unauthorized to notify vendors for this project" }, { status: 403 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        productTags: {
          include: {
            product: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    companyName: true,
                  },
                },
                vendorRecord: {
                  select: {
                    id: true,
                    name: true,
                    primaryEmail: true,
                  },
                },
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
        designer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const notifications: Promise<any>[] = [];
    const sentKeys = new Set<string>();

    for (const tag of project.productTags) {
      const product = tag.product;

      // Get vendor email from vendorRecord (preferred) or vendor (User)
      let vendorEmail: string | null = null;
      let vendorName: string | null = null;

      if (product.vendorRecord?.primaryEmail) {
        vendorEmail = product.vendorRecord.primaryEmail;
        vendorName = product.vendorRecord.name;
      } else if (product.vendor?.email) {
        vendorEmail = product.vendor.email;
        vendorName = product.vendor.name || product.vendor.companyName || null;
      }

      // Skip if no vendor email
      if (!vendorEmail) {
        continue;
      }

      // Create unique key to avoid duplicate notifications
      const key = `${product.vendorRecord?.id || product.vendorId}-${product.id}`;
      if (sentKeys.has(key)) {
        continue;
      }
      sentKeys.add(key);

      // Send notification
      notifications.push(
        sendVendorProductPreviewEmail({
          vendorEmail,
          vendorName: vendorName || undefined,
          productId: product.id,
          projectId: project.id,
        }).catch((error) => {
          console.error(
            `Failed to send notification to ${vendorEmail}:`,
            error
          );
          return { error: error.message };
        })
      );
    }

    // Wait for all notifications to complete
    await Promise.all(notifications);

    return NextResponse.json({
      ok: true,
      count: sentKeys.size,
      message: `Notifications sent to ${sentKeys.size} vendor${sentKeys.size === 1 ? "" : "s"}`,
    });
  } catch (error: any) {
    console.error("Error notifying vendors:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}




