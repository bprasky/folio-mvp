"use client";

import React from 'react';
import SafeImage from '@/components/SafeImage';
import Link from 'next/link';
import { UIEvent } from '../EditorialFeed';

const dev = process.env.NODE_ENV !== 'production';

const getImageUrl = (e:any) =>
  e?.heroImageUrl || e?.coverImageUrl || e?.imageUrl || '/images/event-placeholder.jpg';

const getHref = (e:any) => (e?.href ? String(e.href) : (e?.id ? `/events/${e.id}` : '#'));

interface MosaicFourProps {
  items: UIEvent[];
  onClick?: (id: string) => void;
  canEdit?: boolean;
}

export default function MosaicFour({ items, onClick, canEdit = false }: MosaicFourProps) {
  if (!items || items.length === 0) {
    return dev ? (
      <div className="rounded border border-dashed p-4 text-xs text-red-700 bg-red-50">
        [MosaicFour] items empty
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {items.map((item, index) => (
        <div 
          key={item.id}
          className="relative group overflow-hidden rounded-xl shadow-md"
        >
          {/* Edit button - only when canEdit */}
          {canEdit && (
            <div className="absolute right-2 top-2 z-10 pointer-events-auto">
              <Link
                href={`/admin/events/new?edit=${item.id}`}
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
            href={getHref(item)}
            className="absolute inset-0 z-0"
            aria-label={String(item?.title ?? '')}
          >
            {dev && (
              <div className="mb-1 text-[10px] bg-emerald-200 text-emerald-900 inline-block px-1.5 rounded">
                TILE ok · {String(item?.title ?? '')}
              </div>
            )}
            <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
              <SafeImage
                src={getImageUrl(item)}
                alt={String(item?.title ?? '')}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            </div>

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
              {/* Event Type Badge */}
              {item.eventTypes[0] && (
                <div className="mb-2">
                  <span className="px-2 py-1 text-xs font-medium bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                    {item.eventTypes[0]}
                  </span>
                </div>
              )}

              {/* Title */}
              <h3 className="text-sm font-bold mb-1 line-clamp-2">
                {item.title}
              </h3>

              {/* Meta */}
              <div className="text-xs text-white/80">
                <div className="flex items-center gap-1 mb-1">
                  {item.city && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {item.city}
                    </span>
                  )}
                  
                  {item.venue && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {item.venue}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDate(item.startsAt)}
                </div>
              </div>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
} 