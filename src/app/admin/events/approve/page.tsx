'use client';

import { useState, useEffect } from 'react';
import { useRole } from '../../../../contexts/RoleContext';
import Navigation from '../../../../components/Navigation';
import { FaCheck, FaTimes, FaArrowLeft, FaClock, FaUser, FaMapMarkerAlt, FaCalendarAlt } from 'react-icons/fa';
import Link from 'next/link';
import Image from 'next/image';

interface PendingEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  date: string;
  location: string;
  coverImage: string;
  hostType: string;
  hostName: string;
  eventType: string;
  approvalStatus: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    profileImage: string;
    profileType: string;
  };
  parentEvent?: {
    id: string;
    title: string;
    slug: string;
  };
}

export default function AdminEventApprovalPage() {
  const { role } = useRole();
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Redirect if not admin
  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-folio-background flex">
        <Navigation />
        <div className="flex-1 lg:ml-20 xl:ml-56 flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-folio-text mb-2">Admin Only</h2>
            <p className="text-folio-border">Access denied. Admin privileges required.</p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadPendingEvents();
  }, []);

  const loadPendingEvents = async () => {
    try {
      // For demo purposes, using mock data. In real app, this would be an API call
      const mockPendingEvents: PendingEvent[] = [
        {
          id: 'event-1',
          title: 'Sustainable Furniture Showcase',
          slug: 'sustainable-furniture-showcase',
          description: 'Showcasing our latest collection of eco-friendly furniture designs perfect for modern homes.',
          date: '2024-07-15T14:00:00Z',
          location: 'Booth #12, Main Exhibition Hall',
          coverImage: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
          hostType: 'vendor',
          hostName: 'EcoDesign Co.',
          eventType: 'event',
          approvalStatus: 'pending',
          createdAt: '2024-01-10T10:00:00Z',
          createdBy: {
            id: 'vendor-1',
            name: 'Sarah Johnson',
            profileImage: 'https://randomuser.me/api/portraits/women/44.jpg',
            profileType: 'vendor'
          },
          parentEvent: {
            id: 'festival-1',
            title: 'Spring Design Festival 2024',
            slug: 'spring-design-festival-2024'
          }
        },
        {
          id: 'event-2',
          title: 'Smart Home Technology Demo',
          slug: 'smart-home-technology-demo',
          description: 'Interactive demonstration of the latest smart home technologies and IoT devices for modern living.',
          date: '2024-07-15T16:00:00Z',
          location: 'Tech Pavilion, Room B',
          coverImage: 'https://images.unsplash.com/photo-1558618666-4c0c4def8e10?auto=format&fit=crop&w=800&q=80',
          hostType: 'lender',
          hostName: 'TechHome Solutions',
          eventType: 'event',
          approvalStatus: 'pending',
          createdAt: '2024-01-11T14:30:00Z',
          createdBy: {
            id: 'lender-1',
            name: 'Michael Chen',
            profileImage: 'https://randomuser.me/api/portraits/men/32.jpg',
            profileType: 'lender'
          },
          parentEvent: {
            id: 'festival-1',
            title: 'Spring Design Festival 2024',
            slug: 'spring-design-festival-2024'
          }
        }
      ];

      setPendingEvents(mockPendingEvents);
    } catch (error) {
      console.error('Error loading pending events:', error);
      setError('Failed to load pending events');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = async (eventId: string, action: 'approve' | 'reject') => {
    setActionLoading(eventId);
    setError('');

    try {
      // For demo purposes, we'll simulate the API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real app, this would be an API call:
      // const response = await fetch(`/api/events/${eventId}/approve`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ action, approvedBy: 'admin-user-id' })
      // });

      // Update the local state to remove the approved/rejected event
      setPendingEvents(prev => prev.filter(event => event.id !== eventId));

      // Show success message
      const actionText = action === 'approve' ? 'approved' : 'rejected';
      alert(`Event ${actionText} successfully!`);
    } catch (error) {
      console.error(`Error ${action}ing event:`, error);
      setError(`Failed to ${action} event. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-folio-background flex">
        <Navigation />
        <div className="flex-1 lg:ml-20 xl:ml-56 flex items-center justify-center p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-folio-background flex">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-folio-accent hover:text-folio-accent-hover mb-4"
            >
              <FaArrowLeft className="w-4 h-4" />
              Back to Admin Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-folio-text mb-2">Event Approvals</h1>
            <p className="text-folio-border">Review and approve events submitted by vendors and lenders</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Pending Events */}
          {pendingEvents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-folio-border p-8 text-center">
              <FaClock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Events</h3>
              <p className="text-gray-600">All events have been reviewed. New submissions will appear here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingEvents.map((event) => (
                <div key={event.id} className="bg-white rounded-xl shadow-sm border border-folio-border overflow-hidden">
                  <div className="p-6">
                    <div className="flex gap-6">
                      {/* Event Image */}
                      <div className="relative w-48 h-32 flex-shrink-0 rounded-lg overflow-hidden">
                        <Image
                          src={event.coverImage}
                          alt={event.title}
                          fill
                          className="object-cover"
                        />
                      </div>

                      {/* Event Details */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-folio-text mb-2">{event.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-folio-border">
                              <span className="flex items-center gap-1">
                                <FaCalendarAlt className="w-4 h-4" />
                                {new Date(event.date).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </span>
                              <span className="flex items-center gap-1">
                                <FaMapMarkerAlt className="w-4 h-4" />
                                {event.location}
                              </span>
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-sm font-medium rounded-full">
                            Pending Approval
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>

                        {/* Submitter Info */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="relative w-8 h-8 rounded-full overflow-hidden">
                            <Image
                              src={event.createdBy.profileImage}
                              alt={event.createdBy.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Submitted by {event.createdBy.name}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">
                              {event.createdBy.profileType} • {event.hostName}
                            </p>
                          </div>
                        </div>

                        {/* Parent Festival */}
                        {event.parentEvent && (
                          <div className="mb-4">
                            <p className="text-sm text-folio-border">
                              <span className="font-medium">Festival:</span> {event.parentEvent.title}
                            </p>
                          </div>
                        )}

                        {/* Submission Date */}
                        <p className="text-xs text-gray-500 mb-4">
                          Submitted {new Date(event.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleApprovalAction(event.id, 'reject')}
                        disabled={actionLoading === event.id}
                        className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {actionLoading === event.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <FaTimes className="w-4 h-4" />
                        )}
                        Reject
                      </button>
                      
                      <button
                        onClick={() => handleApprovalAction(event.id, 'approve')}
                        disabled={actionLoading === event.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {actionLoading === event.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <FaCheck className="w-4 h-4" />
                        )}
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}