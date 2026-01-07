'use client';

import { useCallback } from 'react';
import { getEventPostReport } from "@/lib/mock/eventPost";

// AI-first dashboard
import { AiDashboard } from "@/components/vendor/events/ai/AiDashboard";
import { AnalyticsDrawer } from "@/components/vendor/events/ai/AnalyticsDrawer";

interface EventDashboardContentProps {
  eventId: string;
}

export function EventDashboardContent({ eventId }: EventDashboardContentProps) {
  const report = getEventPostReport(eventId);

  const handleExport = useCallback(() => {
    console.log('Exporting AI report data...');
    // In a real app, this would generate CSV files for insights, receipts, etc.
  }, []);

  const handleShare = useCallback(() => {
    console.log('Sharing AI report...');
  }, []);

  const handleViewEvent = useCallback(() => {
    window.open(`/events/${eventId}`, '_blank');
  }, [eventId]);

  return (
    <>
      <AiDashboard 
        eventId={eventId}
        onExport={handleExport}
        onShare={handleShare}
        onViewEvent={handleViewEvent}
      />
      <AnalyticsDrawer data={report} />
    </>
  );
}