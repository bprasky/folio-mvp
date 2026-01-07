import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/requireAdmin";
import AtelierDesignerConstellation from "./_AtelierDesignerConstellation";

type Props = {
  params: { designerId: string };
};

export default async function AtelierDesignerPage({ params }: Props) {
  await requireAdmin();

  const { designerId } = params;

  const designer = await prisma.user.findUnique({
    where: { id: designerId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!designer) return notFound();

  const fingerprint = await prisma.atelierFingerprint.findFirst({
    where: {
      ownerType: "DESIGNER",
      designerId,
    },
    include: {
      nodes: true,
      edges: true,
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Atelier – {designer.name ?? "Designer"} Fingerprint
          </h1>
          <p className="text-sm text-muted-foreground">
            Internal constellation view of this designer&apos;s evolving design fingerprint.
          </p>
        </div>
        {fingerprint && (
          <div className="flex flex-col items-end">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Fingerprint completeness
            </span>
            <span className="text-lg font-medium">
              {(fingerprint.completeness * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {!fingerprint ? (
        <div className="rounded-xl border px-4 py-8 text-sm text-muted-foreground">
          No Atelier fingerprint computed yet for this designer. Once they have onboarding, projects, and
          tags, run the Atelier aggregation to generate their constellation.
        </div>
      ) : (
        <AtelierDesignerConstellation fingerprint={fingerprint} />
      )}
    </div>
  );
}




