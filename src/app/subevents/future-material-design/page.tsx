'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, Users, Heart, Share2, Camera, ShoppingBag, Star, ArrowLeft, Mic, Users2 } from 'lucide-react';

interface SubEvent {
  id: string;
  title: string;
  description: string;
  type: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  price: number;
  imageUrl: string;
  eventId: string;
  qrCode: string;
  rsvps: RSVP[];
  featuredProducts: Product[];
  media: Media[];
  speakers: Speaker[];
  metrics: {
    totalRSVPs: number;
    capacity: number;
    mediaUploads: number;
    productViews: number;
  };
}

interface RSVP {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  userType: string;
  status: 'confirmed' | 'pending' | 'waitlist';
  rsvpTime: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  vendorName: string;
  category: string;
}

interface Media {
  id: string;
  type: 'image' | 'video';
  url: string;
  caption: string;
  uploaderName: string;
  uploadTime: string;
}

interface Speaker {
  id: string;
  name: string;
  title: string;
  company: string;
  imageUrl: string;
  bio: string;
}

export default function FutureMaterialDesignPage() {
  const [subEvent, setSubEvent] = useState<SubEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState<'none' | 'confirmed' | 'pending' | 'waitlist'>('none');
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchSubEvent();
  }, []);

  const fetchSubEvent = async () => {
    try {
      const response = await fetch('/api/subevents/future-material-design');
      if (response.ok) {
        const data = await response.json();
        setSubEvent(data);
        setRsvpStatus(data.userRSVPStatus || 'none');
      }
    } catch (error) {
      console.error('Error fetching sub-event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async () => {
    if (!subEvent) return;
    
    setRsvpLoading(true);
    try {
      const response = await fetch('/api/subevents/future-material-design/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: rsvpStatus === 'none' ? 'rsvp' : 'cancel' })
      });

      if (response.ok) {
        const result = await response.json();
        setRsvpStatus(result.status);
        fetchSubEvent(); // Refresh data
      }
    } catch (error) {
      console.error('Error handling RSVP:', error);
    } finally {
      setRsvpLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!subEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Sub-event not found</h1>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="relative h-96 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/40 z-10"></div>
        <img
          src={subEvent.imageUrl || 'https://source.unsplash.com/random/1200x800?materials,design,innovation'}
          alt={subEvent.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 z-20 flex items-end">
          <div className="container mx-auto px-4 pb-8">
            <button
              onClick={() => router.back()}
              className="mb-4 inline-flex items-center text-white hover:text-blue-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Event
            </button>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-purple-600 text-white text-sm font-medium rounded-full">
                  {subEvent.type}
                </span>
                <span className="px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-full">
                  NYCxDesign 2025
                </span>
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">{subEvent.title}</h1>
              <div className="flex items-center gap-6 text-white/90">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <span>{formatDate(subEvent.startTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>{formatTime(subEvent.startTime)} - {formatTime(subEvent.endTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  <span>{subEvent.location}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Panel</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                {subEvent.description || "Join industry leaders and innovators for a thought-provoking discussion on the future of material design. This panel brings together experts from sustainable materials, circular design, and emerging technologies to explore how materials will shape the future of design and manufacturing."}
              </p>
              
              {/* Event Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Capacity</p>
                    <p className="font-semibold text-gray-900">{subEvent.metrics.totalRSVPs}/{subEvent.metrics.capacity}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Price</p>
                    <p className="font-semibold text-gray-900">
                      {subEvent.price === 0 ? 'Free' : `$${subEvent.price}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Mic className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Speakers</p>
                    <p className="font-semibold text-gray-900">
                      {subEvent.speakers ? subEvent.speakers.length : 4}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Speakers */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Speakers</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subEvent.speakers ? subEvent.speakers.map((speaker) => (
                  <div key={speaker.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                    <img
                      src={speaker.imageUrl || 'https://source.unsplash.com/random/80x80?portrait'}
                      alt={speaker.name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{speaker.name}</h3>
                      <p className="text-sm text-blue-600 font-medium mb-1">{speaker.title}</p>
                      <p className="text-sm text-gray-600 mb-2">{speaker.company}</p>
                      <p className="text-sm text-gray-500">{speaker.bio}</p>
                    </div>
                  </div>
                )) : (
                  // Fallback speakers for this specific event
                  [
                    {
                      id: 'speaker-1',
                      name: 'Dr. Sarah Chen',
                      title: 'Director of Sustainable Materials',
                      company: 'Material Bank',
                      imageUrl: 'https://source.unsplash.com/random/80x80?woman,portrait',
                      bio: 'Leading research in circular economy materials and sustainable design practices.'
                    },
                    {
                      id: 'speaker-2',
                      name: 'Marcus Rodriguez',
                      title: 'Innovation Lead',
                      company: 'Design Futures Lab',
                      imageUrl: 'https://source.unsplash.com/random/80x80?man,portrait',
                      bio: 'Exploring emerging materials and their applications in modern design.'
                    },
                    {
                      id: 'speaker-3',
                      name: 'Elena Petrova',
                      title: 'CEO & Founder',
                      company: 'EcoMaterials Inc.',
                      imageUrl: 'https://source.unsplash.com/random/80x80?woman,executive',
                      bio: 'Pioneering bio-based materials for commercial and residential applications.'
                    },
                    {
                      id: 'speaker-4',
                      name: 'David Kim',
                      title: 'Research Director',
                      company: 'MIT Design Lab',
                      imageUrl: 'https://source.unsplash.com/random/80x80?man,professor',
                      bio: 'Advancing the intersection of technology and material science in design.'
                    }
                  ].map((speaker) => (
                    <div key={speaker.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                      <img
                        src={speaker.imageUrl}
                        alt={speaker.name}
                        className="w-20 h-20 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{speaker.name}</h3>
                        <p className="text-sm text-blue-600 font-medium mb-1">{speaker.title}</p>
                        <p className="text-sm text-gray-600 mb-2">{speaker.company}</p>
                        <p className="text-sm text-gray-500">{speaker.bio}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Featured Products */}
            {subEvent.featuredProducts && subEvent.featuredProducts.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Innovative Materials Showcase</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {subEvent.featuredProducts.map((product) => (
                    <div key={product.id} className="group cursor-pointer">
                      <div className="relative overflow-hidden rounded-xl mb-4">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium">
                          ${product.price}
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{product.vendorName}</p>
                      <p className="text-sm text-gray-500">{product.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Media Feed */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Event Media</h2>
                <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium">
                  <Camera className="w-5 h-5" />
                  Upload Media
                </button>
              </div>
              
              {subEvent.media && subEvent.media.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subEvent.media.map((item) => (
                    <div key={item.id} className="group cursor-pointer">
                      <div className="relative overflow-hidden rounded-xl mb-3">
                        <img
                          src={item.url}
                          alt={item.caption}
                          className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{item.caption}</p>
                      <p className="text-xs text-gray-500">by {item.uploaderName}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No media uploaded yet</p>
                  <p className="text-sm text-gray-400">Share photos and insights from the panel discussion!</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* RSVP Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">RSVP</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    rsvpStatus === 'confirmed' ? 'bg-green-100 text-green-800' :
                    rsvpStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    rsvpStatus === 'waitlist' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {rsvpStatus === 'none' ? 'Not RSVPed' :
                     rsvpStatus === 'confirmed' ? 'Confirmed' :
                     rsvpStatus === 'pending' ? 'Pending' : 'Waitlist'}
                  </span>
                </div>

                <button
                  onClick={handleRSVP}
                  disabled={rsvpLoading}
                  className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${
                    rsvpStatus === 'none' || rsvpStatus === 'pending' || rsvpStatus === 'waitlist'
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  } disabled:opacity-50`}
                >
                  {rsvpLoading ? 'Processing...' :
                   rsvpStatus === 'none' ? 'RSVP Now' :
                   rsvpStatus === 'confirmed' ? 'Cancel RSVP' :
                   rsvpStatus === 'pending' ? 'Cancel RSVP' : 'Cancel Waitlist'}
                </button>

                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    {subEvent.metrics.totalRSVPs} of {subEvent.metrics.capacity} spots filled
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(subEvent.metrics.totalRSVPs / subEvent.metrics.capacity) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendees */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Attendees</h3>
              
              {subEvent.rsvps && subEvent.rsvps.length > 0 ? (
                <div className="space-y-3">
                  {subEvent.rsvps.slice(0, 10).map((rsvp) => (
                    <div key={rsvp.id} className="flex items-center gap-3">
                      <img
                        src={rsvp.userImage || 'https://source.unsplash.com/random/40x40?portrait'}
                        alt={rsvp.userName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{rsvp.userName}</p>
                        <p className="text-sm text-gray-500">{rsvp.userType}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        rsvp.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        rsvp.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {rsvp.status}
                      </span>
                    </div>
                  ))}
                  {subEvent.rsvps.length > 10 && (
                    <p className="text-sm text-gray-500 text-center pt-2">
                      +{subEvent.rsvps.length - 10} more attendees
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No attendees yet</p>
              )}
            </div>

            {/* Event Stats */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Event Stats</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">RSVPs</span>
                  <span className="font-semibold text-gray-900">{subEvent.metrics.totalRSVPs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Media Uploads</span>
                  <span className="font-semibold text-gray-900">{subEvent.metrics.mediaUploads}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Product Views</span>
                  <span className="font-semibold text-gray-900">{subEvent.metrics.productViews}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                  <Share2 className="w-5 h-5" />
                  Share Event
                </button>
                <button className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                  <Heart className="w-5 h-5" />
                  Save to Calendar
                </button>
                <button className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                  <Star className="w-5 h-5" />
                  Rate Event
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 