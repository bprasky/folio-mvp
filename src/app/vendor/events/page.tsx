'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Plus, 
  Eye, 
  EyeOff, 
  TrendingUp, 
  Users, 
  Camera, 
  QrCode, 
  Calendar,
  MapPin,
  Clock,
  Star,
  Edit,
  Trash,
  Filter,
  Search,
  BarChart3,
  Zap,
  Crown,
  Lock,
  Unlock
} from 'lucide-react';

interface SubEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  type: string;
  isPrivate: boolean;
  isInviteOnly: boolean;
  isBoosted: boolean;
  boostExpiresAt?: string;
  trendingScore: number;
  viewCount: number;
  mediaCount: number;
  productScanCount: number;
  capacity?: number;
  maxRSVPs?: number;
  isFeatured: boolean;
  featuredReason?: string;
  qrCode?: string;
  event: {
    id: string;
    title: string;
  };
  products: Array<{
    id: string;
    product: {
      id: string;
      name: string;
      imageUrl: string;
      scanCount: number;
      likeCount: number;
      saveCount: number;
    };
  }>;
  rsvps: Array<{
    id: string;
    user: {
      id: string;
      name: string;
      profileImage: string;
      profileType: string;
    };
  }>;
}

export default function VendorEventsPage() {
  const router = useRouter();
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchVendorSubEvents();
  }, []);

  const fetchVendorSubEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/vendor/subevents');
      if (response.ok) {
        const data = await response.json();
        setSubEvents(data.subEvents || []);
      }
    } catch (error) {
      console.error('Error fetching vendor sub-events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBoost = async (subEventId: string) => {
    try {
      const response = await fetch(`/api/subevents/${subEventId}/boost`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boosted: true })
      });

      if (response.ok) {
        fetchVendorSubEvents();
      }
    } catch (error) {
      console.error('Error boosting sub-event:', error);
    }
  };

  const handleToggleVisibility = async (subEventId: string, isPrivate: boolean) => {
    try {
      const response = await fetch(`/api/subevents/${subEventId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrivate: !isPrivate })
      });

      if (response.ok) {
        fetchVendorSubEvents();
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  const handleDelete = async (subEventId: string) => {
    if (!confirm('Are you sure you want to delete this sub-event?')) return;

    try {
      const response = await fetch(`/api/subevents/${subEventId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchVendorSubEvents();
      }
    } catch (error) {
      console.error('Error deleting sub-event:', error);
    }
  };

  const filteredSubEvents = subEvents.filter(subEvent => {
    const matchesSearch = subEvent.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subEvent.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filter === 'all' || 
                         (filter === 'private' && subEvent.isPrivate) ||
                         (filter === 'public' && !subEvent.isPrivate) ||
                         (filter === 'boosted' && subEvent.isBoosted) ||
                         (filter === 'featured' && subEvent.isFeatured);

    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getTrendingScoreColor = (score: number) => {
    if (score >= 100) return 'text-red-600';
    if (score >= 50) return 'text-orange-600';
    if (score >= 20) return 'text-yellow-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-folio-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-folio-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-folio-text">My Events</h1>
            <p className="mt-2 text-folio-border">
              Manage your sub-events, track engagement, and boost visibility
            </p>
          </div>
          <div className="mt-4 lg:mt-0 flex space-x-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-folio-accent text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Sub-Event
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-folio-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-folio-border">Total Sub-Events</p>
                <p className="text-2xl font-bold text-folio-text">{subEvents.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-folio-accent" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 border border-folio-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-folio-border">Total Views</p>
                <p className="text-2xl font-bold text-folio-text">
                  {subEvents.reduce((sum, event) => sum + event.viewCount, 0).toLocaleString()}
                </p>
              </div>
              <Eye className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 border border-folio-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-folio-border">Total RSVPs</p>
                <p className="text-2xl font-bold text-folio-text">
                  {subEvents.reduce((sum, event) => sum + event.rsvps.length, 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 border border-folio-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-folio-border">Product Scans</p>
                <p className="text-2xl font-bold text-folio-text">
                  {subEvents.reduce((sum, event) => sum + event.productScanCount, 0).toLocaleString()}
                </p>
              </div>
              <QrCode className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border border-folio-border p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-folio-border h-4 w-4" />
              <input
                type="text"
                placeholder="Search sub-events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-folio-border rounded-lg focus:ring-folio-accent focus:border-folio-accent"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All', icon: Calendar },
                { key: 'public', label: 'Public', icon: Unlock },
                { key: 'private', label: 'Private', icon: Lock },
                { key: 'boosted', label: 'Boosted', icon: Zap },
                { key: 'featured', label: 'Featured', icon: Crown }
              ].map((filterOption) => (
                <button
                  key={filterOption.key}
                  onClick={() => setFilter(filterOption.key)}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === filterOption.key
                      ? 'bg-folio-accent text-white'
                      : 'bg-folio-muted text-folio-text hover:bg-folio-card'
                  }`}
                >
                  <filterOption.icon className="w-4 h-4 mr-2" />
                  {filterOption.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sub-Events Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSubEvents.map((subEvent) => (
            <div key={subEvent.id} className="bg-white rounded-xl shadow-sm border border-folio-border overflow-hidden hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="p-6 border-b border-folio-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-folio-text mb-1">{subEvent.title}</h3>
                    <p className="text-sm text-folio-border mb-2">{subEvent.event.title}</p>
                    <div className="flex items-center space-x-4 text-xs text-folio-border">
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(subEvent.startTime)}
                      </div>
                      <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        {subEvent.location}
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Badges */}
                  <div className="flex flex-col items-end space-y-1">
                    {subEvent.isPrivate && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <Lock className="w-3 h-3 mr-1" />
                        Private
                      </span>
                    )}
                    {subEvent.isBoosted && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Zap className="w-3 h-3 mr-1" />
                        Boosted
                      </span>
                    )}
                    {subEvent.isFeatured && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Crown className="w-3 h-3 mr-1" />
                        Featured
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-folio-text line-clamp-2">{subEvent.description}</p>
              </div>

              {/* Metrics */}
              <div className="p-6 border-b border-folio-border">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-folio-text">{subEvent.viewCount}</p>
                    <p className="text-xs text-folio-border">Views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-folio-text">{subEvent.rsvps.length}</p>
                    <p className="text-xs text-folio-border">RSVPs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-folio-text">{subEvent.mediaCount}</p>
                    <p className="text-xs text-folio-border">Media</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${getTrendingScoreColor(subEvent.trendingScore)}`}>
                      {subEvent.trendingScore}
                    </p>
                    <p className="text-xs text-folio-border">Trending</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => router.push(`/subevents/${subEvent.id}`)}
                      className="flex items-center px-3 py-2 text-sm font-medium text-folio-accent hover:bg-folio-accent hover:text-white rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </button>
                    <button
                      onClick={() => router.push(`/vendor/events/${subEvent.id}/edit`)}
                      className="flex items-center px-3 py-2 text-sm font-medium text-folio-text hover:bg-folio-muted rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </button>
                  </div>
                  
                  <div className="flex space-x-2">
                    {!subEvent.isBoosted && (
                      <button
                        onClick={() => handleBoost(subEvent.id)}
                        className="flex items-center px-3 py-2 text-sm font-medium text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                      >
                        <Zap className="w-4 h-4 mr-1" />
                        Boost
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleVisibility(subEvent.id, subEvent.isPrivate)}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      {subEvent.isPrivate ? (
                        <>
                          <Unlock className="w-4 h-4 mr-1" />
                          Make Public
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-1" />
                          Make Private
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(subEvent.id)}
                      className="flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash className="w-4 h-4 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredSubEvents.length === 0 && !loading && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-folio-border mx-auto mb-4" />
            <h3 className="text-lg font-medium text-folio-text mb-2">No sub-events found</h3>
            <p className="text-folio-border mb-4">
              {searchTerm || filter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Create your first sub-event to get started'
              }
            </p>
            {!searchTerm && filter === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-folio-accent text-white rounded-lg hover:bg-opacity-90 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Sub-Event
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Create Sub-Event</h3>
            <p className="text-folio-border mb-4">
              This feature will be implemented next. For now, you can create sub-events through the main event pages.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-folio-text hover:bg-folio-muted rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  router.push('/events');
                }}
                className="px-4 py-2 bg-folio-accent text-white rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Go to Events
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 