"use client";

import React from "react";
import { usePathname } from "next/navigation";
import BlurContainer from "@/components/ui/BlurContainer";

// Mirrors FestivalLayoutClient: show modal slot when URL matches /events/preview/:eventId
export default function EventsLayoutClient({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const pathname = usePathname();
  const hasModal = /\/events\/preview\/[^/]+$/.test(pathname || "");

  return (
    <div className="relative">
      <BlurContainer blurred={hasModal}>{children}</BlurContainer>
      {hasModal ? modal : null}
    </div>
  );
}
