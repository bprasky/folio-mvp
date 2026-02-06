import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { ApproveHighlightsClient } from "@/components/interviews/ApproveHighlightsClient";

export default async function ApproveHighlightsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    notFound();
  }

  const interviewSession = await prisma.interviewSession.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      recordingAsset: {
        select: {
          id: true,
          url: true,
          durationMs: true,
        },
      },
      highlights: {
        orderBy: {
          score: "desc",
        },
        select: {
          id: true,
          quoteText: true,
          useCase: true,
          startMs: true,
          endMs: true,
          score: true,
          approvedByDesigner: true,
          productId: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          brand: true,
        },
      },
    },
  });

  if (!interviewSession) {
    notFound();
  }

  // Check access
  const isOwner = interviewSession.status === "EXTRACTED" || interviewSession.status === "READY";
  if (!isOwner) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--bg-elevated)]">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-light text-[var(--text-primary)] mb-2">Review & Approve Quotes</h1>
          <p className="text-[var(--text-secondary)]">
            {interviewSession.project?.title || interviewSession.product?.name || "Interview"}
          </p>
        </div>

        <ApproveHighlightsClient
          interviewSession={interviewSession}
          recordingUrl={interviewSession.recordingAsset?.url || null}
        />
      </div>
    </div>
  );
}



