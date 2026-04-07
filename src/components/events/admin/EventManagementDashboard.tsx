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
        <Loader2 className="w-8 h-8 animate-spin text-folio-text-tertiary" />
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
        <p className="text-sm text-folio-text-tertiary">
          Manage invites, workflows, and analytics for your event
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-folio-border-subtle">
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
                    : 'text-folio-text-tertiary hover:text-ink'
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
            <div className="bg-surface-canvas rounded-xl border border-folio-border-subtle shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-folio-text-tertiary" />
                <span className="text-2xl font-serif font-medium text-ink">
                  {metrics?.totalInvites || 0}
                </span>
              </div>
              <p className="text-sm text-folio-text-tertiary">Total Invites</p>
            </div>
            <div className="bg-surface-canvas rounded-xl border border-folio-border-subtle shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-folio-text-tertiary" />
                <span className="text-2xl font-serif font-medium text-ink">
                  {metrics?.totalRSVPs || 0}
                </span>
              </div>
              <p className="text-sm text-folio-text-tertiary">Total RSVPs</p>
            </div>
            <div className="bg-surface-canvas rounded-xl border border-folio-border-subtle shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-folio-text-tertiary" />
                <span className="text-2xl font-serif font-medium text-ink">
                  {metrics?.estimatedRevenue 
                    ? `$${(metrics.estimatedRevenue / 1000).toFixed(1)}k`
                    : 'N/A'}
                </span>
              </div>
              <p className="text-sm text-folio-text-tertiary">Estimated Revenue</p>
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
            <div className="bg-surface-canvas rounded-xl border border-folio-border-subtle shadow-sm p-6">
              <h3 className="font-medium text-ink mb-4">Post-Event Workflows</h3>
              <div className="space-y-3">
                <WorkflowButton
                  eventId={eventId}
                  type="recap"
                  label="Send Thank-You to Checked-In"
                  description="Send thank-you emails to all checked-in attendees"
                  body={{ type: "thank_you" }}
                />
                <WorkflowButton
                  eventId={eventId}
                  type="recap"
                  label="Send 'Sorry We Missed You'"
                  description="Email attendees who RSVP'd but didn't check in"
                  body={{ type: "no_show" }}
                />
                <WorkflowButton
                  eventId={eventId}
                  type="recap"
                  label="Follow Up with Walk-Ins"
                  description="Encourage walk-in guests to complete their Folio profile"
                  body={{ type: "walk_in_followup" }}
                />
                <WorkflowButton
                  eventId={eventId}
                  type="recap"
                  label="Send Product Recap"
                  description="Send scanned product collection to attendees who scanned products"
                  body={{ type: "product_recap" }}
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
              <div className="mt-4 pt-4 border-t border-folio-border-subtle">
                <Link
                  href={`/events/${eventId}/dashboard`}
                  className="inline-flex items-center text-sm font-medium text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Live Check-In Dashboard &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <Link
              href={`/events/${eventId}/graph`}
              className="block bg-surface-canvas rounded-xl border border-folio-border-subtle shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-ink mb-1">Event Graph</h3>
                  <p className="text-sm text-folio-text-tertiary">
                    View complete event relationship graph
                  </p>
                </div>
                <TrendingUp className="w-5 h-5 text-folio-text-tertiary" />
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
  body,
}: {
  eventId: string;
  type: string;
  label: string;
  description: string;
  body?: Record<string, string>;
}) {
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const response = await fetch(`/api/events/${eventId}/workflow/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
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
      className="w-full text-left p-4 border border-folio-border-subtle rounded-lg hover:bg-surface-ground transition-colors disabled:opacity-50"
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-ink">{label}</h4>
          <p className="text-sm text-folio-text-tertiary mt-1">{description}</p>
        </div>
        {isRunning ? (
          <Loader2 className="w-4 h-4 animate-spin text-folio-text-tertiary" />
        ) : (
          <Settings className="w-4 h-4 text-folio-text-tertiary" />
        )}
      </div>
    </button>
  );
}




