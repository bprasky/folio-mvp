'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  Heart, 
  Share2, 
  Eye, 
  Camera, 
  Tag, 
  Star,
  ArrowLeft,
  CheckCircle,
  UserPlus,
  TrendingUp,
  Award,
  Zap,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  Phone,
  ChevronRight,
  Filter,
  Grid,
  List,
  Plus,
  FolderPlus,
  Sparkles
} from 'lucide-react';
import ProjectCreationModal from '@/components/ProjectCreationModal';

interface SubEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  type: string;
  featuredGuest?: string;
  capacity?: number;
  tags: string[];
  event: {
    id: string;
    title: string;
    location: string;
    city: string;
    state: string;
    country: string;
  };
  rsvps: Array<{
    id: string;
    user: {
      id: string;
      name: string;
      profileImage: string;
      profileType: string;
      location: string;
      specialties?: string[];
      followers: number;
    };
    isPublic: boolean;
    createdAt: string;
  }>;
  media: Array<{
    id: string;
    url: string;
    type: 'image' | 'video';
    caption?: string;
    user: {
      id: string;
      name: string;
      profileImage: string;
      profileType: string;
    };
    createdAt: string;
  }>;
  products: Array<{
    id: string;
    product: {
      id: string;
      name: string;
      imageUrl: string;
      price: number;
      brand: string;
      category: string;
    };
  }>;
  spotlightProducts: Array<{
    id: string;
    product: {
      id: string;
      name: string;
      imageUrl: string;
      price: number;
      brand: string;
      category: string;
      description?: string;
    };
    featured: boolean;
    spotlightReason?: string;
  }>;
  metrics: {
    totalRSVPs: number;
    publicRSVPs: number;
    totalMedia: number;
    totalProducts: number;
    topProducts: Array<{
      id: string;
      name: string;
      imageUrl: string;
      price: number;
      brand: string;
      scanCount: number;
      saveCount: number;
      uploadCount: number;
    }>;
  };
}

export default function SubEventPage() {
  const params = useParams();
  const router = useRouter();
  const [subEvent, setSubEvent] = useState<SubEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [hasRSVPd, setHasRSVPd] = useState(false);
  const [isPublicRSVP, setIsPublicRSVP] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendees' | 'products' | 'spotlight' | 'media'>('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Mock current user
  const currentUser = {
    id: 'user-1',
    name: 'Sarah Chen',
    profileImage: '/images/designers/sarah-chen.jpg',
    profileType: 'designer'
  };

  useEffect(() => {
    if (params?.id) {
      fetchSubEvent();
    }
  }, [params?.id]);

  const fetchSubEvent = async () => {
    try {
      const response = await fetch(`/api/subevents/${params?.id}`);
      if (response.ok) {
        const data = await response.json();
        setSubEvent(data);
        
        // Check if current user has RSVP'd
        const userRSVP = data.rsvps.find((rsvp: any) => rsvp.user.id === currentUser.id);
        if (userRSVP) {
          setHasRSVPd(true);
          setIsPublicRSVP(userRSVP.isPublic);
        }
      }
    } catch (error) {
      console.error('Error fetching subevent:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async () => {
    setRsvpLoading(true);
    try {
      const response = await fetch(`/api/subevents/${params?.id}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          isPublic: isPublicRSVP,
        }),
      });

      if (response.ok) {
        setHasRSVPd(true);
        fetchSubEvent(); // Refresh data
      }
    } catch (error) {
      console.error('Error RSVPing:', error);
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleCancelRSVP = async () => {
    setRsvpLoading(true);
    try {
      const response = await fetch(`/api/subevents/${params?.id}/rsvp?userId=${currentUser.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setHasRSVPd(false);
        fetchSubEvent(); // Refresh data
      }
    } catch (error) {
      console.error('Error canceling RSVP:', error);
    } finally {
      setRsvpLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-slate-200 rounded mb-6"></div>
            <div className="space-y-4">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                      </div>
        </div>
      </div>
      
      {/* Project Creation Modal */}
      <ProjectCreationModal
        isOpen={showProjectModal}
        onClose={() => {
          setShowProjectModal(false);
          setSelectedProducts([]);
        }}
        onProjectCreated={(project) => {
          setShowProjectModal(false);
          setSelectedProducts([]);
          // Optionally redirect to the new project
          router.push(`/project/${project.id}`);
        }}
        currentUserId={currentUser.id}
      />
    </div>
  );
}

  if (!subEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">SubEvent Not Found</h1>
          <Link href="/events" className="text-blue-600 hover:text-blue-800">
            ← Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <Link 
                  href={`/events/${subEvent.event.id}`}
                  className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {subEvent.event.title}
                </Link>
                <h1 className="text-xl font-bold text-slate-900">{subEvent.title}</h1>
              </div>
            </div>
            
            {/* RSVP Button */}
            <div className="flex items-center space-x-3">
              {hasRSVPd ? (
                <button
                  onClick={handleCancelRSVP}
                  disabled={rsvpLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Cancel RSVP</span>
                </button>
              ) : (
                <button
                  onClick={handleRSVP}
                  disabled={rsvpLoading}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{rsvpLoading ? 'RSVPing...' : 'RSVP'}</span>
                </button>
              )}
              
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Share2 className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Event Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{subEvent.title}</h2>
                    <p className="text-slate-600 mb-4">{subEvent.description}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {subEvent.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-slate-500" />
                      <div>
                        <p className="font-medium text-slate-900">{formatDate(subEvent.date)}</p>
                        <p className="text-sm text-slate-500">{formatTime(subEvent.time)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <MapPin className="w-5 h-5 text-slate-500" />
                      <div>
                        <p className="font-medium text-slate-900">{subEvent.location}</p>
                        <p className="text-sm text-slate-500">
                          {subEvent.event.city}, {subEvent.event.state}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-slate-500" />
                      <div>
                        <p className="font-medium text-slate-900">{subEvent.metrics.publicRSVPs} attending</p>
                        <p className="text-sm text-slate-500">
                          {subEvent.capacity ? `${subEvent.capacity - subEvent.metrics.totalRSVPs} spots left` : 'Open event'}
                        </p>
                      </div>
                    </div>

                    {subEvent.featuredGuest && (
                      <div className="flex items-center space-x-3">
                        <Star className="w-5 h-5 text-yellow-500" />
                        <div>
                          <p className="font-medium text-slate-900">Featured Guest</p>
                          <p className="text-sm text-slate-500">{subEvent.featuredGuest}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
              <div className="border-b border-slate-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'overview', label: 'Overview', icon: Eye },
                    { id: 'attendees', label: 'Attendees', icon: Users },
                    { id: 'products', label: 'Products', icon: Tag },
                    { id: 'spotlight', label: 'Spotlight', icon: FolderPlus },
                    { id: 'media', label: 'Media', icon: Camera },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
                        <div className="flex items-center space-x-3">
                          <Users className="w-8 h-8 text-blue-600" />
                          <div>
                            <p className="text-2xl font-bold text-blue-900">{subEvent.metrics.totalRSVPs}</p>
                            <p className="text-sm text-blue-700">Total RSVPs</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
                        <div className="flex items-center space-x-3">
                          <Camera className="w-8 h-8 text-green-600" />
                          <div>
                            <p className="text-2xl font-bold text-green-900">{subEvent.metrics.totalMedia}</p>
                            <p className="text-sm text-green-700">Media Uploads</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
                        <div className="flex items-center space-x-3">
                          <Tag className="w-8 h-8 text-purple-600" />
                          <div>
                            <p className="text-2xl font-bold text-purple-900">{subEvent.metrics.totalProducts}</p>
                            <p className="text-sm text-purple-700">Featured Products</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top Products */}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Products This Event</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {subEvent.metrics.topProducts.slice(0, 4).map((product) => (
                          <div key={product.id} className="bg-slate-50 rounded-lg p-4">
                            <div className="flex items-center space-x-3">
                              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-200">
                                <Image
                                  src={product.imageUrl}
                                  alt={product.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">{product.name}</p>
                                <p className="text-sm text-slate-500">{product.brand}</p>
                                <div className="flex items-center space-x-4 mt-1">
                                  <span className="text-xs text-slate-500">{product.scanCount} scans</span>
                                  <span className="text-xs text-slate-500">{product.saveCount} saves</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Attendees Tab */}
                {activeTab === 'attendees' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {subEvent.metrics.publicRSVPs} People Attending
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Filter className="w-4 h-4 text-slate-500" />
                        <select className="text-sm border border-slate-200 rounded-lg px-3 py-1">
                          <option>All Attendees</option>
                          <option>Designers</option>
                          <option>High Profile</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subEvent.rsvps.map((rsvp) => (
                        <div key={rsvp.id} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-200">
                            <Image
                              src={rsvp.user.profileImage}
                              alt={rsvp.user.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{rsvp.user.name}</p>
                            <p className="text-sm text-slate-500 capitalize">{rsvp.user.profileType}</p>
                            {rsvp.user.specialties && (
                              <p className="text-xs text-slate-400">
                                {rsvp.user.specialties.slice(0, 2).join(', ')}
                              </p>
                            )}
                          </div>
                          {rsvp.user.followers > 1000 && (
                            <div className="flex items-center space-x-1">
                              <Star className="w-3 h-3 text-yellow-500" />
                              <span className="text-xs text-slate-500">Verified</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Products Tab */}
                {activeTab === 'products' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Featured Products ({subEvent.products.length})
                      </h3>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-slate-500'}`}
                        >
                          <Grid className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-slate-500'}`}
                        >
                          <List className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
                      {subEvent.products.map((item) => (
                        <div key={item.id} className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-200">
                              <Image
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{item.product.name}</p>
                              <p className="text-sm text-slate-500">{item.product.brand}</p>
                              <p className="text-sm font-medium text-slate-700">
                                ${item.product.price?.toLocaleString()}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spotlight Tab */}
                {activeTab === 'spotlight' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Spotlight Products ({subEvent.spotlightProducts?.length || 0})
                      </h3>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => setShowProjectModal(true)}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <FolderPlus className="w-4 h-4" />
                          <span>Add to Project</span>
                        </button>
                        <button className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                          <Plus className="w-4 h-4" />
                          <span>Add Product</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {(subEvent.spotlightProducts || []).map((item) => (
                        <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                          <div className="relative aspect-square bg-slate-100">
                            <Image
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              fill
                              className="object-cover"
                            />
                            {item.featured && (
                              <div className="absolute top-3 left-3">
                                <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-500 text-white text-xs rounded-full">
                                  <Sparkles className="w-3 h-3" />
                                  <span>Featured</span>
                                </div>
                              </div>
                            )}
                            <button 
                              onClick={() => {
                                if (selectedProducts.includes(item.product.id)) {
                                  setSelectedProducts(selectedProducts.filter(id => id !== item.product.id));
                                } else {
                                  setSelectedProducts([...selectedProducts, item.product.id]);
                                }
                              }}
                              className={`absolute top-3 right-3 p-1 rounded-full transition-colors ${
                                selectedProducts.includes(item.product.id) 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-white/80 text-slate-600 hover:bg-white'
                              }`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold text-slate-900 mb-1">{item.product.name}</h4>
                                <p className="text-sm text-slate-500 mb-2">{item.product.brand}</p>
                                <p className="text-lg font-bold text-slate-900">
                                  ${item.product.price?.toLocaleString()}
                                </p>
                              </div>
                            </div>
                            {item.spotlightReason && (
                              <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                                <p className="text-xs text-blue-700 font-medium">Why it's featured:</p>
                                <p className="text-xs text-blue-600">{item.spotlightReason}</p>
                              </div>
                            )}
                            {item.product.description && (
                              <p className="text-sm text-slate-600 mt-2">{item.product.description}</p>
                            )}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                              <span className="text-xs text-slate-500 capitalize">{item.product.category}</span>
                              <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                View Details →
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {selectedProducts.length > 0 && (
                      <div className="fixed bottom-6 right-6 z-50">
                        <button
                          onClick={() => setShowProjectModal(true)}
                          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
                        >
                          <FolderPlus className="w-5 h-5" />
                          <span>Add {selectedProducts.length} to Project</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Media Tab */}
                {activeTab === 'media' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Event Media ({subEvent.media.length})
                      </h3>
                      <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        <Camera className="w-4 h-4" />
                        <span>Upload Media</span>
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subEvent.media.map((item) => (
                        <div key={item.id} className="bg-slate-50 rounded-lg overflow-hidden">
                          <div className="relative aspect-square bg-slate-200">
                            <Image
                              src={item.url}
                              alt={item.caption || 'Event media'}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="p-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="relative w-6 h-6 rounded-full overflow-hidden bg-slate-200">
                                <Image
                                  src={item.user.profileImage}
                                  alt={item.user.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                              <p className="text-sm font-medium text-slate-900">{item.user.name}</p>
                            </div>
                            {item.caption && (
                              <p className="text-sm text-slate-600">{item.caption}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* RSVP Status */}
            {hasRSVPd && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">You're attending!</p>
                    <p className="text-sm text-green-700">
                      {isPublicRSVP ? 'Your RSVP is public' : 'Your RSVP is private'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Event Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Event Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total RSVPs</span>
                  <span className="font-medium text-slate-900">{subEvent.metrics.totalRSVPs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Public RSVPs</span>
                  <span className="font-medium text-slate-900">{subEvent.metrics.publicRSVPs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Media Uploads</span>
                  <span className="font-medium text-slate-900">{subEvent.metrics.totalMedia}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Featured Products</span>
                  <span className="font-medium text-slate-900">{subEvent.metrics.totalProducts}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-slate-50 rounded-lg transition-colors">
                  <Calendar className="w-5 h-5 text-slate-500" />
                  <span className="text-slate-700">Add to Calendar</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-slate-50 rounded-lg transition-colors">
                  <Share2 className="w-5 h-5 text-slate-500" />
                  <span className="text-slate-700">Share Event</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-slate-50 rounded-lg transition-colors">
                  <Camera className="w-5 h-5 text-slate-500" />
                  <span className="text-slate-700">Upload Media</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-slate-50 rounded-lg transition-colors">
                  <Tag className="w-5 h-5 text-slate-500" />
                  <span className="text-slate-700">Tag Products</span>
                </button>
              </div>
            </div>

            {/* Event Location */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Location</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-slate-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900">{subEvent.location}</p>
                    <p className="text-sm text-slate-500">
                      {subEvent.event.city}, {subEvent.event.state} {subEvent.event.country}
                    </p>
                  </div>
                </div>
                <button className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                  Get Directions
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 