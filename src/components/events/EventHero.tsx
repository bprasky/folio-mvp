"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { formatEventDateTime } from "@/lib/events";
import SafeImage from "@/components/SafeImage";

interface EventHeroProps {
  event: {
    id: string;
    title: string;
    description: string;
    location: string;
    startDate: Date;
    endDate: Date;
    imageUrl?: string | null;
    heroImageUrl?: string | null;
    createdBy: {
      id: string;
      name: string;
      companyName?: string | null;
    };
  };
  userRSVP?: {
    id: string;
    status: string;
  } | null;
}

export default function EventHero({ event, userRSVP }: EventHeroProps) {
  const { data: session } = useSession();
  const [rsvpStatus, setRsvpStatus] = useState(userRSVP?.status || "none");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRSVP = async (status: string) => {
    if (!session?.user?.id) {
      // Trigger auth flow - you can implement this based on your auth setup
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/events/${event.id}/rsvp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        setRsvpStatus(status);
      }
    } catch (error) {
      console.error("Error updating RSVP:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToCalendar = async () => {
    // Create calendar event data
    const eventData = {
      title: event.title,
      description: event.description,
      location: event.location,
      startTime: event.startDate.toISOString(),
      endTime: event.endDate.toISOString(),
    };

    // Create calendar URL (Google Calendar)
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventData.title)}&details=${encodeURIComponent(eventData.description)}&location=${encodeURIComponent(eventData.location)}&dates=${eventData.startTime.replace(/[-:]/g, "").replace(/\.\d{3}/, "")}/${eventData.endTime.replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`;

    // Track analytics
    try {
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verb: "ADD_TO_CAL",
          eventId: event.id,
        }),
      });
    } catch (error) {
      console.error("Error tracking analytics:", error);
    }

    // Open calendar
    window.open(googleUrl, "_blank");
  };

  const heroImage = event.heroImageUrl || event.imageUrl || "/images/event-placeholder.jpg";

  return (
    <div className="relative w-full">
      {/* Hero Background */}
      <div className="relative w-full h-[50vh] min-h-[400px] max-h-[600px] overflow-hidden bg-gray-200">
        <SafeImage
          src={heroImage}
          alt={event.title}
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/40" />
        
        {/* Back Button */}
        <a 
          href="/events" 
          className="absolute top-4 left-4 z-50 rounded-full bg-black/50 hover:bg-black/70 text-white px-3 py-2 text-sm transition-colors"
        >
          ← Back to Events
        </a>

        {/* Hero Content */}
        <div className="absolute inset-0 flex items-end">
          <div className="w-full bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 sm:p-8">
            <div className="max-w-4xl mx-auto">
              {/* Event Info */}
              <div className="text-white mb-6">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
                  {event.title}
                </h1>
                
                <div className="space-y-2 text-lg sm:text-xl">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatEventDateTime(event.startDate, event.endDate)}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{event.location}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{event.createdBy.companyName || event.createdBy.name}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* RSVP Dropdown */}
                <div className="relative">
                  <select
                    value={rsvpStatus}
                    onChange={(e) => handleRSVP(e.target.value)}
                    disabled={isSubmitting}
                    className="appearance-none bg-white/90 backdrop-blur-sm text-gray-900 px-6 py-3 rounded-lg font-medium border-0 focus:ring-2 focus:ring-folio-accent focus:outline-none disabled:opacity-50"
                  >
                    <option value="none">RSVP</option>
                    <option value="attending">Attending</option>
                    <option value="interested">Interested</option>
                    <option value="declined">Declined</option>
                  </select>
                  <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Add to Calendar */}
                <button
                  onClick={handleAddToCalendar}
                  className="inline-flex items-center justify-center px-6 py-3 border border-white/30 text-white rounded-lg hover:bg-white/10 transition-colors font-medium"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Add to Calendar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="bg-white py-8">
          <div className="max-w-4xl mx-auto px-6 sm:px-8">
            <p className="text-gray-700 text-lg leading-relaxed">
              {event.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 