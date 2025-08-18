"use client";

import { useState, useEffect } from "react";
import { LiveActivityItem } from "@/lib/events";

interface LiveActivityProps {
  eventId?: string;
  initialActivity?: LiveActivityItem[];
}

export default function LiveActivity({ eventId, initialActivity }: LiveActivityProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activity, setActivity] = useState<LiveActivityItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize activity from props or fetch
  useEffect(() => {
    if (initialActivity !== undefined) {
      setActivity(initialActivity);
      return;
    }

    if (!eventId) {
      setActivity([]);
      return;
    }

    // Fetch initial activity
    fetch(`/api/events/${eventId}/live-activity`)
      .then(res => res.json())
      .then(data => {
        setActivity(data.activity || []);
      })
      .catch(error => {
        console.error("Error fetching live activity:", error);
        setActivity([]);
      });
  }, [initialActivity, eventId]);

  useEffect(() => {
    if (!isExpanded || !eventId) return;

    const pollActivity = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/events/${eventId}/live-activity`);
        if (response.ok) {
          const data = await response.json();
          setActivity(data.activity || []);
        }
      } catch (error) {
        console.error("Error fetching live activity:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Poll every 15 seconds
    const interval = setInterval(pollActivity, 15000);
    
    // Initial poll
    pollActivity();

    return () => clearInterval(interval);
  }, [eventId, isExpanded]);

  // Loading state
  if (activity === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (!activity || activity.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-neutral-500">No live activity yet.</p>
      </div>
    );
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-3">
      {isLoading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
        </div>
      )}
      
      {activity.map((item) => (
        <div key={item.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
          {/* Activity Icon */}
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>

          {/* Activity Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900">
              <span className="font-medium">{item.user.name}</span>
              {" saved "}
              <span className="font-medium">{item.product.name}</span>
              {" to "}
              <span className="font-medium">{item.project.name}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatTimeAgo(item.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
} 