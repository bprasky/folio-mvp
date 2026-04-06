"use client";

import Link from "next/link";

type SigProps = {
  signature?: string | null; // prefer a short line from profile, else null
  designerName?: string | null;
  logoUrl?: string | null;
  profileHref?: string | null; // e.g., /designer/[id]
};

export function DesignerSignature({
  signature,
  designerName,
  logoUrl,
  profileHref,
}: SigProps) {
  const name = designerName || "Designer";

  return (
    <div className="mt-6 rounded-2xl bg-surface-canvas/60 backdrop-blur-md ring-1 ring-black/5 p-4 flex items-center gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="h-10 w-10 object-contain rounded-md"
        />
      ) : null}
      <div className="text-sm text-folio-text-primary">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px]">✍️</span>
          <em className="not-italic">
            {signature || "Every corner of this home tells a story."}
          </em>
          <span className="text-folio-text-tertiary mx-1">—</span>
          {profileHref ? (
            <Link
              href={profileHref}
              className="underline-offset-2 hover:underline"
            >
              {name}
            </Link>
          ) : (
            <strong className="font-medium">{name}</strong>
          )}
        </div>
      </div>
    </div>
  );
}


