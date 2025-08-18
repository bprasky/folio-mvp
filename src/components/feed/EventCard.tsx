"use client";
import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import type { UIEvent } from "@/lib/normalizeEvent";
import type { Size } from "@/lib/flow/score";

export default function EventCard({
  item, size, canEdit = false
}: { item: UIEvent; size: Size; canEdit?: boolean }) {
  // Typography scale by size
  const titleCls =
    size === "L" ? "text-lg font-semibold leading-snug line-clamp-3" :
    size === "M" ? "text-base font-semibold leading-snug line-clamp-2" :
                   "text-sm font-semibold leading-tight line-clamp-1";
  const metaCls = size === "L" ? "text-sm text-white/90" : "text-xs text-white/80";

  return (
    <div className="group relative h-full rounded-2xl overflow-hidden border border-folio-border bg-black/5 shadow-sm hover:shadow transition">
      <Link href={item.href} className="block h-full">
        {/* Full-bleed image */}
        <SafeImage
          src={item.imageUrl || "/images/event-placeholder.jpg"}
          alt={item.title}
          fill
          className="object-cover"
        />
        {/* Soft gradient for readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        {/* Text overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className={`text-white ${titleCls}`}>{item.title}</div>
          <div className={metaCls}>
            {item.startsAt ? new Date(item.startsAt).toLocaleDateString() : "TBA"}
          </div>
        </div>
      </Link>

      {canEdit && (
        <Link
          href={`/admin/events/new?edit=${item.id}`}
          onClick={(e)=>e.stopPropagation()}
          className="absolute top-2 right-2 z-10 rounded bg-black/70 text-white px-2 py-1 text-xs"
        >
          ✎ Edit
        </Link>
      )}
    </div>
  );
} 