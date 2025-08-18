"use client";

import { useSession } from "next-auth/react";
import EventHero from "./EventHero";
import FestivalContext from "./FestivalContext";
import FeaturedProducts from "./FeaturedProducts";
import BreakoutPanel from "./BreakoutPanel";
import Schedule from "./Schedule";
import LiveActivity from "./LiveActivity";
import UserRecap from "./UserRecap";
import { 
  EventWithRelations, 
  FeaturedProduct, 
  TrendingProduct, 
  SiblingEvent, 
  UserEventRecap, 
  LiveActivityItem 
} from "@/lib/events";

interface EventLayoutProps {
  event: EventWithRelations;
  featuredProducts: FeaturedProduct[];
  trendingProducts: TrendingProduct[];
  siblingEvents: SiblingEvent[];
  userRecaps: UserEventRecap[];
  liveActivity: LiveActivityItem[];
  userRSVP?: {
    id: string;
    status: string;
  } | null;
}

export default function EventLayout({
  event,
  featuredProducts,
  trendingProducts,
  siblingEvents,
  userRecaps,
  liveActivity,
  userRSVP,
}: EventLayoutProps) {
  const { data: session } = useSession();
  const isChildEvent = !!event.parentFestivalId;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <EventHero event={event} userRSVP={userRSVP} />

      {/* Festival Context (only for child events) */}
      {isChildEvent && event.parentFestival && (
        <FestivalContext 
          festival={event.parentFestival} 
          eventTitle={event.title} 
        />
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Content Column */}
          <div className="xl:col-span-3 space-y-8">
            {/* Featured Products */}
            <FeaturedProducts 
              products={featuredProducts}
              eventId={event.id}
              eventTitle={event.title}
            />

            {/* Schedule */}
            <Schedule 
              siblingEvents={siblingEvents}
              eventId={event.id}
              festivalId={event.parentFestivalId}
              festivalTitle={event.parentFestival?.title}
            />

            {/* User Recap */}
            <UserRecap 
              recaps={userRecaps}
              eventId={event.id}
            />
          </div>

          {/* Sidebar */}
          <div className="xl:col-span-1 space-y-6">
            {/* Breakout Panel */}
            <BreakoutPanel 
              products={trendingProducts}
              eventId={event.id}
              eventTitle={event.title}
            />

            {/* Live Activity */}
            <LiveActivity 
              eventId={event.id}
              initialActivity={liveActivity}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 