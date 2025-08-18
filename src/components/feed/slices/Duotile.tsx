"use client";

import React from 'react';
import SafeImage from '@/components/SafeImage';
import Link from 'next/link';
import { UIEvent } from '../EditorialFeed';

const dev = process.env.NODE_ENV !== 'production';

const getImageUrl = (e:any) =>
  e?.heroImageUrl || e?.coverImageUrl || e?.imageUrl || '/images/event-placeholder.jpg';

const getHref = (e:any) => (e?.href ? String(e.href) : (e?.id ? `/events/${e.id}` : '#'));

interface DuotileProps {
  items: UIEvent[];
  onClick?: (id: string) => void;
  canEdit?: boolean;
}

export default function Duotile({ items, onClick, canEdit = false }: DuotileProps) {
  if (!items || items.length === 0) {
    return dev ? (
      <div className="rounded border border-dashed p-4 text-xs text-red-700 bg-red-50">
        [Duotile] items empty
      </div>
    ) : null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };



  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Large Tile - First Item */}
      <div className="lg:col-span-2 relative group overflow-hidden rounded-xl shadow-md">
        {/* Edit button - only when canEdit */}
        {canEdit && (
          <div className="absolute right-3 top-3 z-10 pointer-events-auto">
            <Link
              href={`/admin/events/new?edit=${items[0].id}`}
              className="inline-flex items-center gap-1 rounded-full bg-black/70 text-white px-2 py-1 text-xs hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-white"
              title="Edit event"
              data-testid="edit-event"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              ✎ Edit
            </Link>
          </div>
        )}

        {/* Main event link overlay */}
        <Link
          href={getHref(items[0])}
          className="absolute inset-0 z-0"
          aria-label={String(items[0]?.title ?? '')}
        >
          {dev && (
            <div className="mb-1 text-[10px] bg-emerald-200 text-emerald-900 inline-block px-1.5 rounded">
              TILE ok · {String(items[0]?.title ?? '')}
            </div>
          )}
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
            <SafeImage
              src={getImageUrl(items[0])}
              alt={String(items[0]?.title ?? '')}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 66vw, 50vw"
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          </div>

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            {/* Event Type Badges */}
            <div className="flex flex-wrap gap-2 mb-2">
              {items[0].eventTypes.slice(0, 2).map((type, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs font-medium bg-white/20 backdrop-blur-sm rounded-full border border-white/30"
                >
                  {type}
                </span>
              ))}
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold mb-2 line-clamp-2">
              {items[0].title}
            </h3>

            {/* Meta */}
            <div className="flex items-center gap-3 text-sm text-white/80">
              {items[0].city && (
                <span>{items[0].city}</span>
              )}
              {items[0].venue && (
                <span>• {items[0].venue}</span>
              )}
              <span>• {formatDate(items[0].startsAt)}</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Small Tile - Second Item (if exists) */}
      {items[1] && (
        <div className="relative group overflow-hidden rounded-xl shadow-md">
          {/* Edit button - only when canEdit */}
          {canEdit && (
            <div className="absolute right-2 top-2 z-10 pointer-events-auto">
              <Link
                href={`/admin/events/new?edit=${items[1].id}`}
                className="inline-flex items-center gap-1 rounded-full bg-black/70 text-white px-2 py-1 text-xs hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-white"
                title="Edit event"
                data-testid="edit-event"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                ✎ Edit
              </Link>
            </div>
          )}

          {/* Main event link overlay */}
          <Link
            href={getHref(items[1])}
            className="absolute inset-0 z-0"
            aria-label={String(items[1]?.title ?? '')}
          >
            {dev && (
              <div className="mb-1 text-[10px] bg-emerald-200 text-emerald-900 inline-block px-1.5 rounded">
                TILE ok · {String(items[1]?.title ?? '')}
              </div>
            )}
            <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
              <SafeImage
                src={getImageUrl(items[1])}
                alt={String(items[1]?.title ?? '')}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 33vw, 25vw"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            </div>

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
              {/* Event Type Badge */}
              {items[1].eventTypes[0] && (
                <div className="mb-2">
                  <span className="px-2 py-1 text-xs font-medium bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                    {items[1].eventTypes[0]}
                  </span>
                </div>
              )}

              {/* Title */}
              <h4 className="text-sm font-bold mb-1 line-clamp-2">
                {items[1].title}
              </h4>

              {/* Meta */}
              <div className="text-xs text-white/80">
                {items[1].city && <span>{items[1].city}</span>}
                {items[1].city && items[1].venue && <span> • </span>}
                {items[1].venue && <span>{items[1].venue}</span>}
                <span> • {formatDate(items[1].startsAt)}</span>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
} 