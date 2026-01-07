"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Calendar, Users, TrendingUp, DollarSign, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';
import InviteComposer from '../InviteComposer';

interface EventManagementDashboardProps {
  eventId: string;
}

export default function EventManagementDashboard({ eventId }: EventManagementDashboardProps) {
  const { data: session } = useSession();
  const [event, setEvent] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'invites' | 'workflow' | 'analytics'>('overview');

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const [eventRes, metricsRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/events/${eventId}/graph`),
      ]);

      if (eventRes.ok) {
        const eventData = await eventRes.json();
        setEvent(eventData.data || eventData);
      }

      if (metricsRes.ok) {
        const graphData = await metricsRes.json();
        setMetrics(graphData.metrics);
      }
    } catch (error) {
      console.error('Error fetching event data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Calendar },
    { id: 'invites', label: 'Invites', icon: Users },
    { id: 'workflow', label: 'Workflow', icon: Settings },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-medium text-ink mb-2">
          {event?.title || 'Event Management'}
        </h1>
        <p className="text-sm text-stone-500">
          Manage invites, workflows, and analytics for your event
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200">
        <div className="flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-sm font-medium transition-colors flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'text-ink border-b-2 border-accent-700'
                    : 'text-stone-500 hover:text-ink'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-stone-500" />
                <span className="text-2xl font-serif font-medium text-ink">
                  {metrics?.totalInvites || 0}
                </span>
              </div>
              <p className="text-sm text-stone-500">Total Invites</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-stone-500" />
                <span className="text-2xl font-serif font-medium text-ink">
                  {metrics?.totalRSVPs || 0}
                </span>
              </div>
              <p className="text-sm text-stone-500">Total RSVPs</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-stone-500" />
                <span className="text-2xl font-serif font-medium text-ink">
                  {metrics?.estimatedRevenue 
                    ? `$${(metrics.estimatedRevenue / 1000).toFixed(1)}k`
                    : 'N/A'}
                </span>
              </div>
              <p className="text-sm text-stone-500">Estimated Revenue</p>
            </div>
          </div>
        )}

        {activeTab === 'invites' && (
          <div>
            <InviteComposer eventId={eventId} />
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
              <h3 className="font-medium text-ink mb-4">Post-Event Workflows</h3>
              <div className="space-y-3">
                <WorkflowButton
                  eventId={eventId}
                  type="recap"
                  label="Send Recap Emails"
                  description="Send post-event recap to all attendees"
                />
                <WorkflowButton
                  eventId={eventId}
                  type="follow"
                  label="Auto-Follow Relationships"
                  description="Automatically follow designers, vendors, and products"
                />
                <WorkflowButton
                  eventId={eventId}
                  type="vendor-dashboard"
                  label="Update Vendor Dashboards"
                  description="Sync engagement metrics to vendor dashboards"
                />
                <WorkflowButton
                  eventId={eventId}
                  type="followups"
                  label="Generate Follow-ups"
                  description="Create designer product follow-up suggestions"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <Link
              href={`/events/${eventId}/graph`}
              className="block bg-white rounded-xl border border-stone-200 shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-ink mb-1">Event Graph</h3>
                  <p className="text-sm text-stone-500">
                    View complete event relationship graph
                  </p>
                </div>
                <TrendingUp className="w-5 h-5 text-stone-400" />
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowButton({
  eventId,
  type,
  label,
  description,
}: {
  eventId: string;
  type: string;
  label: string;
  description: string;
}) {
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const response = await fetch(`/api/events/${eventId}/workflow/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Success: ${data.message || 'Workflow completed'}`);
      } else {
        alert(`Error: ${data.error || 'Workflow failed'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message || 'Workflow failed'}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <button
      onClick={handleRun}
      disabled={isRunning}
      className="w-full text-left p-4 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-ink">{label}</h4>
          <p className="text-sm text-stone-500 mt-1">{description}</p>
        </div>
        {isRunning ? (
          <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
        ) : (
          <Settings className="w-4 h-4 text-stone-400" />
        )}
      </div>
    </button>
  );
}




