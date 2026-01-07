import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";

export default async function AtelierIndexPage() {
  await requireAdmin();

  // Fetch designers with fingerprints, ordered by completeness desc
  const fingerprints = await prisma.atelierFingerprint.findMany({
    where: { ownerType: "DESIGNER" },
    include: {
      designer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      completeness: "desc",
    },
  });

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Atelier – Designer Fingerprints</h1>
          <p className="text-sm text-muted-foreground">
            Internal view of evolving design fingerprints. This is for admin use only.
          </p>
        </div>
      </header>

      <div className="border rounded-xl divide-y bg-background/40 backdrop-blur-sm">
        {fingerprints.map((fp) => (
          <Link
            key={fp.id}
            href={`/admin/atelier/designer/${fp.designerId}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {fp.designer?.name ?? fp.designerId ?? "Unknown designer"}
              </span>
              <span className="text-xs text-muted-foreground">
                Fingerprint completeness: {(fp.completeness * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-8">
                {/* simple radial completeness indicator */}
                <svg viewBox="0 0 36 36" className="h-8 w-8">
                  <path
                    className="text-muted-foreground/20"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-foreground"
                    strokeWidth="3"
                    stroke="currentColor"
                    strokeDasharray={`${fp.completeness * 100}, 100`}
                    fill="none"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
              </div>
              <span className="text-xs text-muted-foreground">View constellation →</span>
            </div>
          </Link>
        ))}
        {fingerprints.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No Atelier fingerprints yet. Once designers start onboarding and projects are tagged, run the
            Atelier aggregation to see fingerprints here.
          </div>
        )}
      </div>
    </div>
  );
}




