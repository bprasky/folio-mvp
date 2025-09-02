import React from "react";
import EventsLayoutClient from "./EventsLayoutClient";

export const runtime = "nodejs";

export default function EventsLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  // Pass modal explicitly as a prop (do NOT concatenate into children)
  return <EventsLayoutClient modal={modal}>{children}</EventsLayoutClient>;
}
