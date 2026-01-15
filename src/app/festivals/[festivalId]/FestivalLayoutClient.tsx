"use client";

import React from "react";
import { usePathname } from "next/navigation";
import BlurContainer from "@/components/ui/BlurContainer";

/**
 * Blur ONLY when the URL matches:
 *   /festivals/:festivalId/subevents/:eventId
 * Works regardless of parallel route internals.
 *
 * Folio Design System: Uses bg-[var(--bg-base)] for base background
 */
export default function FestivalLayoutClient({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const pathname = usePathname();

  // Deep-linkable nested modal path:
  //   /festivals/<anything>/subevents/<anything>
  const hasModal = /\/festivals\/[^/]+\/subevents\/[^/]+$/.test(pathname || "");

  return (
    <div className="relative bg-[var(--bg-base)]">
      <BlurContainer blurred={hasModal}>{children}</BlurContainer>
      {hasModal ? modal : null}
    </div>
  );
}
