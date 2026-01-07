'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calendar, MapPin, Download, Share2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { EventAnalytics } from "@/lib/mock/eventAnalytics";
import { formatDateRange } from "@/lib/format";

interface EventHeaderProps {
  event: EventAnalytics;
}

export function EventHeader({ event }: EventHeaderProps) {
  return (
    <Card className="bg-white border-[#DAD2CA]">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-[#8C8278] mb-4">
              <Link 
                href="/vendor/dashboard" 
                className="flex items-center space-x-1 hover:text-[#2B2B2B] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <span>/</span>
              <span className="text-[#8C8278]">Analytics</span>
            </div>

            {/* Event Title */}
            <CardTitle className="text-2xl font-serif text-[#2B2B2B] mb-2">
              {event.eventName}
            </CardTitle>

            {/* Event Details */}
            <div className="flex flex-wrap items-center gap-6 text-[#8C8278]">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>{formatDateRange(event.dates.start, event.dates.end)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>{event.location.city}{event.location.country ? `, ${event.location.country}` : ''}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Share Report
            </Button>
            <Button size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Event Page
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}








