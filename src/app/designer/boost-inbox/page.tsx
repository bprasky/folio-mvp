import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BoostInboxClient } from "@/components/interviews/BoostInboxClient";

export default async function BoostInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    notFound();
  }

  // Fetch boost requests for this designer
  const requests = await prisma.vendorBoostRequest.findMany({
    where: {
      requestedDesignerId: session.user.id,
      status: {
        in: ["PENDING", "ACCEPTED", "COMPLETED"],
      },
    },
    orderBy: {
      requestedAt: "desc",
    },
    select: {
      id: true,
      status: true,
      message: true,
      requestedAt: true,
      expiresAt: true,
      acceptedAt: true,
      completedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          brand: true,
          imageUrl: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
        },
      },
      vendor: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
      interviewSession: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-[var(--bg-elevated)]">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-light text-gray-900 mb-2">Boost Requests</h1>
          <p className="text-gray-500">
            Vendors have requested your insights on products in their projects
          </p>
        </div>

        <BoostInboxClient requests={requests} />
      </div>
    </div>
  );
}



