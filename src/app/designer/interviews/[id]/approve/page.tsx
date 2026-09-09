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
      createdByUserId: true,
      MediaAsset: {
        select: {
          id: true,
          durationMs: true,
        },
      },
      QuoteHighlight: {
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
      projects: {
        select: {
          id: true,
          title: true,
        },
      },
      products: {
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
  if (!isOwner || interviewSession.createdByUserId !== session.user.id || session.user.role !== "DESIGNER") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-surface-ground">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-light text-folio-text-primary mb-2">Review & Approve Quotes</h1>
          <p className="text-folio-text-secondary">
            {interviewSession.projects?.title || interviewSession.products?.name || "Interview"}
          </p>
        </div>

        <ApproveHighlightsClient
          interviewSession={{ id: interviewSession.id, status: interviewSession.status, highlights: interviewSession.QuoteHighlight }}
          hasRecording={!!interviewSession.MediaAsset}
        />
      </div>
    </div>
  );
}



