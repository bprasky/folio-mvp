import React from 'react';

interface ConciergeAnalyticsProps {
  eventType: 'concierge_started' | 'concierge_completed' | 'concierge_abandoned' | 'concierge_rated';
  userId?: string;
  userRole?: string;
  eventData?: any;
  rating?: number;
  duration?: number;
  source?: 'recommendation' | 'floating_button' | 'direct';
}

export default function ConciergeAnalytics({ 
  eventType, 
  userId, 
  userRole, 
  eventData, 
  rating, 
  duration, 
  source 
}: ConciergeAnalyticsProps) {
  
  const trackEvent = async () => {
    try {
      const analyticsData = {
        event: eventType,
        userId,
        userRole,
        timestamp: new Date().toISOString(),
        source,
        rating,
        duration,
        extractedFields: eventData ? Object.keys(eventData) : [],
        eventTypes: eventData?.eventTypes || [],
        isVirtual: eventData?.isVirtual || false,
        isSponsored: eventData?.isSponsored || false,
        promotionTier: eventData?.promotionTier || 0,
        includesFood: eventData?.includesFood || false,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
        screenResolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : null
      };

      // Send to analytics endpoint
      await fetch('/api/analytics/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analyticsData)
      });

      // Also log locally for debugging
      console.log('Concierge Analytics:', analyticsData);
      
    } catch (error) {
      console.error('Failed to track concierge analytics:', error);
    }
  };

  // Track immediately when component mounts
  React.useEffect(() => {
    trackEvent();
  }, []);

  // This component doesn't render anything visible
  return null;
}

// Hook for easy usage
export function useConciergeAnalytics() {
  const trackConciergeEvent = React.useCallback((eventType: ConciergeAnalyticsProps['eventType'], data?: Partial<ConciergeAnalyticsProps>) => {
    const analyticsData = {
      eventType,
      ...data
    };

    // Create a temporary component to trigger tracking
    const tempComponent = React.createElement(ConciergeAnalytics, analyticsData);
    return tempComponent;
  }, []);

  return { trackConciergeEvent };
} 