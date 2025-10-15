'use client';

import Link from "next/link";
import CoverImage from "@/components/ui/CoverImage";
import { FaEdit } from 'react-icons/fa';

type EventCard = {
  id: string;
  title: string;
  imageUrl?: string | null;
  location?: string | null;
  startDate?: Date | string | null;
  eventTypes?: string[] | null;
  // Add any other properties that might come from the actual event type
  [key: string]: any;
};

export default function EventMosaic({ events, canEdit = false }: { events: EventCard[]; canEdit?: boolean }) {
  if (!events?.length) {
    return (
      <div className="rounded-xl border bg-white/80 p-6 text-neutral-600">
        No events yet—check back soon.
      </div>
    );
  }

  // Masonry via CSS columns; each tile prevents splitting
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
      {events.map((e) => (
        <div key={e.id} className="group mb-4 break-inside-avoid relative">
          <Link
            href={`/events/${e.id}`}
            className="block"
          >
            <CoverImage
              src={e.imageUrl ?? null}
              alt={e.title}
              ratio="4/3"
              className="rounded-xl"
              // If CoverImage forwards this, great; if not, it's harmless
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            <div className="mt-2">
              <div className="line-clamp-2 font-medium group-hover:underline">
                {e.title}
              </div>
              {e.location ? (
                <div className="text-sm text-neutral-600">{e.location}</div>
              ) : null}
            </div>
          </Link>
          
          {/* Admin Edit Icon */}
          {canEdit && (
            <Link href={`/admin/events/${e.id}`} onClick={(e) => e.stopPropagation()}>
              <div className="absolute top-2 right-2 bg-blue-500 text-white p-1.5 rounded-full shadow-sm hover:bg-blue-600 transition-colors z-20">
                <FaEdit className="w-3 h-3" />
              </div>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
