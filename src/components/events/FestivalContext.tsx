"use client";

import Link from "next/link";
import { formatEventDate } from "@/lib/events";

interface FestivalContextProps {
  festival: {
    id: string;
    title: string;
    description?: string | null;
    location?: string | null;
    startDate: Date;
    endDate: Date;
    imageUrl?: string | null;
    heroImageUrl?: string | null;
  };
  eventTitle: string;
}

export default function FestivalContext({ festival, eventTitle }: FestivalContextProps) {
  return (
    <div className="bg-white border-b border-folio-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-3">
          <Link 
            href="/events" 
            className="hover:text-folio-accent transition-colors"
          >
            Events
          </Link>
          <span className="text-gray-400">›</span>
          <Link 
            href={`/events/${festival.id}`}
            className="hover:text-folio-accent transition-colors"
          >
            {festival.title}
          </Link>
          <span className="text-gray-400">›</span>
          <span className="text-gray-900 font-medium">{eventTitle}</span>
        </nav>

        {/* Festival Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Festival Chip */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-folio-accent/10 text-folio-accent text-sm font-medium">
              <svg 
                className="w-4 h-4 mr-1.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" 
                />
              </svg>
              Part of Festival
            </div>

            {/* Festival Details */}
            <div className="text-sm text-gray-600">
              <span className="font-medium">{festival.title}</span>
              {festival.location && (
                <>
                  <span className="mx-2">•</span>
                  <span>{festival.location}</span>
                </>
              )}
              <span className="mx-2">•</span>
              <span>{formatEventDate(festival.startDate)}</span>
            </div>
          </div>

          {/* View Full Program Button */}
          <Link
            href={`/events/${festival.id}`}
            className="inline-flex items-center px-4 py-2 border border-folio-accent text-folio-accent rounded-lg hover:bg-folio-accent hover:text-white transition-colors text-sm font-medium"
          >
            <svg 
              className="w-4 h-4 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 5l7 7-7 7" 
              />
            </svg>
            View Full Program
          </Link>
        </div>
      </div>
    </div>
  );
} 