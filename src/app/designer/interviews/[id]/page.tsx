import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { RecordingInterface } from "@/components/interviews/RecordingInterface";
import { InterviewStatusView } from "@/components/interviews/InterviewStatusView";

export default async function InterviewPage({
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
      mode: true,
      promptLens: true,
      errorMessage: true,
      recordedAt: true,
      uploadedAt: true,
      transcribedAt: true,
      extractedAt: true,
      publishedAt: true,
      createdByUserId: true,
      MediaAsset: {
        select: {
          id: true,
          durationMs: true,
          mimeType: true,
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
  if (interviewSession.createdByUserId !== session.user.id || session.user.role !== "DESIGNER") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-surface-ground">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-light text-folio-text-primary mb-2">
            {interviewSession.projects?.title || interviewSession.products?.name || "Interview"}
          </h1>
          <p className="text-folio-text-secondary">
            {interviewSession.projects
              ? "Project Reflection"
              : interviewSession.products
              ? `Product Insight: ${interviewSession.products.brand} ${interviewSession.products.name}`
              : "Recorded Reflection"}
          </p>
        </div>

        {/* Show recording interface if not uploaded yet */}
        {(interviewSession.status === "DRAFT" || interviewSession.status === "UPLOADED") && (
          <div className="bg-white rounded-lg shadow-sm border border-folio-border-subtle p-8">
            <RecordingInterface
              interviewId={interviewSession.id}
            />
          </div>
        )}

        {/* Show status view for other states */}
        {interviewSession.status !== "DRAFT" && (
          <InterviewStatusView interviewSession={{ id: interviewSession.id, status: interviewSession.status, errorMessage: interviewSession.errorMessage, recordingAsset: interviewSession.MediaAsset ? { durationMs: interviewSession.MediaAsset.durationMs } : null, transcribedAt: interviewSession.transcribedAt, extractedAt: interviewSession.extractedAt, publishedAt: interviewSession.publishedAt }} />
        )}
      </div>
    </div>
  );
}



