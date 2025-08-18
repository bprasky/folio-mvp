"use client";
import Link from "next/link";

type Props = {
  id: string;
  show?: boolean;   // computed server/parent-side
  className?: string;
};

export default function FestivalEditOverlay({ id, show, className }: Props) {
  if (!show) return null;
  return (
    <Link
      href={`/admin/events/new?edit=${id}`}
      title="Edit event"
      data-testid="edit-event"
      className={
        "absolute right-3 top-3 z-10 pointer-events-auto inline-flex items-center gap-1 rounded-full bg-black/70 text-white px-2 py-1 text-xs hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-white " +
        (className ?? "")
      }
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      ✎ Edit
    </Link>
  );
} 