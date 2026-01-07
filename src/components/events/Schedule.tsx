"use client";

import { useState, useEffect } from "react";
import { formatEventTime, formatEventDate } from "@/lib/events";
import { SiblingEvent } from "@/lib/events";
import Link from "next/link";
import { eventHref } from "@/lib/paths";
import { trackViewEvent } from "@/lib/track";

interface ScheduleProps {
  siblingEvents?: SiblingEvent[];
  eventId?: string;
  festivalId?: string | null;
  festivalTitle?: string | null;
}

export default function Schedule({ 
  siblingEvents: propSiblingEvents, 
  eventId, 
  festivalId, 
  festivalTitle 
}: ScheduleProps) {
  const [siblingEvents, setSiblingEvents] = useState<SiblingEvent[] | null>(null);
  const [loading, setLoading] = useState(false);

  // If siblingEvents are passed as props, use them; otherwise fetch by eventId
  useEffect(() => {
    if (propSiblingEvents !== undefined) {
      setSiblingEvents(propSiblingEvents);
      return;
    }

    if (!eventId) {
      setSiblingEvents([]);
      return;
    }

    setLoading(true);
    fetch(`/api/events/${eventId}/schedule`)
      .then(res => res.json())
      .then(data => {
        setSiblingEvents(data.events || []);
      })
      .catch(error => {
        console.error("Error fetching schedule:", error);
        setSiblingEvents([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [propSiblingEvents, eventId]);

  // Loading state
  if (loading || siblingEvents === null) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="h-20 bg-gray-200 rounded-xl"></div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (!siblingEvents || siblingEvents.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-neutral-500">No schedule available yet.</p>
      </div>
    );
  }

  // Group events by date
  const eventsByDate = siblingEvents.reduce((acc, event) => {
    // Safe date conversion - handle both Date objects and ISO strings
    const dateKey = (() => {
      try {
        return new Date(event.startDate).toDateString();
      } catch {
        return "Unknown Date";
      }
    })();
    
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, SiblingEvent[]>);

  return (
    <div className="space-y-6">
      {Object.entries(eventsByDate).map(([dateKey, events]) => (
        <div key={dateKey} className="bg-gray-50 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {formatEventDate(new Date(dateKey))}
          </h3>
          
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="relative flex items-start space-x-4 p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                {/* Time */}
                <div className="flex-shrink-0 w-20 text-sm font-medium text-gray-900">
                  {formatEventTime(new Date(event.startDate))}
                </div>

                {/* Event Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {event.title}
                  </h4>
                  
                  {event.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{event.location}</span>
                  </div>
                </div>

                {/* Duration */}
                <div className="flex-shrink-0 text-xs text-gray-500">
                  {(() => {
                    try {
                      const startDate = new Date(event.startDate);
                      const endDate = new Date(event.endDate);
                      return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
                    } catch {
                      return 0;
                    }
                  })()} min
                </div>
                
                {/* Make entire row clickable */}
                <Link
                  href={eventHref(event)}
                  aria-label={`Open session ${event.title}`}
                  className="absolute inset-0"
                  onClick={() => trackViewEvent(event.id)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 