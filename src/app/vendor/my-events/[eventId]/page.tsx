import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getVendorEvents } from "@/lib/mock/eventAnalytics";
import { LoadingSkeleton } from "@/components/vendor/events/LoadingSkeleton";
import { ProAnalyticsDashboard } from "./ProAnalyticsDashboard";
import { AnalyticsDrawerProvider } from "@/components/vendor/events/ai/useAnalyticsDrawer";

interface EventDashboardPageProps {
  params: {
    eventId: string;
  };
}

export default function EventDashboardPage({ params }: EventDashboardPageProps) {
  const { eventId } = params;
  
  // Validate event exists in vendor's events
  const vendorEvents = getVendorEvents();
  const eventExists = vendorEvents.some(event => event.id === eventId);
  
  if (!eventExists) {
    notFound();
  }

  return (
    <AnalyticsDrawerProvider>
      <Suspense fallback={<LoadingSkeleton />}>
        <ProAnalyticsDashboard eventId={eventId} />
      </Suspense>
    </AnalyticsDrawerProvider>
  );
}

