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
      recordingAsset: {
        select: {
          id: true,
          url: true,
          durationMs: true,
          mimeType: true,
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
  if (interviewSession.createdByUserId !== session.user.id) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--bg-elevated)]">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-light text-gray-900 mb-2">
            {interviewSession.project?.title || interviewSession.product?.name || "Interview"}
          </h1>
          <p className="text-gray-500">
            {interviewSession.project
              ? "Project Reflection"
              : interviewSession.product
              ? `Product Insight: ${interviewSession.product.brand} ${interviewSession.product.name}`
              : "Recorded Reflection"}
          </p>
        </div>

        {/* Show recording interface if not uploaded yet */}
        {(interviewSession.status === "DRAFT" || interviewSession.status === "UPLOADED") && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <RecordingInterface
              interviewId={interviewSession.id}
              onUploadComplete={() => {
                // Client-side redirect handled in component
              }}
            />
          </div>
        )}

        {/* Show status view for other states */}
        {interviewSession.status !== "DRAFT" && interviewSession.status !== "UPLOADED" && (
          <InterviewStatusView interviewSession={interviewSession} />
        )}
      </div>
    </div>
  );
}



