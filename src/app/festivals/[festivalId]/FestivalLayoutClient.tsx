"use client";

import React from "react";
import { usePathname } from "next/navigation";
import BlurContainer from "@/components/ui/BlurContainer";

/**
 * Blur ONLY when the URL matches:
 *   /festivals/:festivalId/subevents/:eventId
 * Works regardless of parallel route internals.
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
    <div className="relative">
      <BlurContainer blurred={hasModal}>{children}</BlurContainer>
      {hasModal ? modal : null}
    </div>
  );
}
