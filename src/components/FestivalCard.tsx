'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaExpand, FaEdit } from 'react-icons/fa';
// Define types locally to avoid import issues
interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  eventTypes: string[];
  isPublic: boolean;
  isApproved: boolean | null;
  imageUrl?: string;
  createdBy: {
    id: string;
    name: string;
    companyName: string | null;
  };
  parentFestival?: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
  } | null;
  rsvps?: any[];
  createdAt: string;
  updatedAt: string;
}

interface Festival {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  eventTypes: string[];
  imageUrl?: string;
  createdBy: {
    id: string;
    name: string;
    companyName: string | null;
  };
  subevents: {
    id: string;
  }[];
  rsvps?: any[];
  createdAt?: string;
  updatedAt?: string;
}
// Helper functions to avoid import issues
function getFestivalTags(festival: Festival): { label: string; color: string; glow?: boolean }[] {
  const tags = [];
  const now = new Date();
  const start = new Date(festival.startDate);
  const end = new Date(festival.endDate);
  const created = festival.createdAt ? new Date(festival.createdAt) : now;
  const ageHours = (now.getTime() - created.getTime()) / (1000 * 3600);

  if (start <= now && end >= now) {
    tags.push({ label: 'LIVE', color: 'bg-green-500 text-white shadow-glow', glow: true });
  }
  
  if (ageHours < 48) {
    tags.push({ label: 'New', color: 'bg-blue-100 text-blue-800' });
  }
  
  if (festival.subevents.length > 10) {
    tags.push({ label: 'Flagship', color: 'bg-purple-100 text-purple-800' });
  }
  
  if (festival.location.toLowerCase().includes('international') || festival.location.toLowerCase().includes('global')) {
    tags.push({ label: 'International', color: 'bg-orange-100 text-orange-800' });
  }

  return tags;
}

function getFestivalStatus(festival: Festival): 'live' | 'upcoming' | 'past' {
  const now = new Date();
  const start = new Date(festival.startDate);
  const end = new Date(festival.endDate);
  
  if (start <= now && end >= now) {
    return 'live';
  } else if (start > now) {
    return 'upcoming';
  } else {
    return 'past';
  }
}

function formatFestivalDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

interface FestivalCardProps {
  festival: Festival;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  canEdit?: boolean;
}

export default function FestivalCard({ 
  festival, 
  isExpanded = false, 
  onToggleExpand,
  className = '',
  canEdit = false
}: FestivalCardProps) {
  const [imageError, setImageError] = useState(false);
  const [subevents, setSubevents] = useState<Event[]>([]);
  const [loadingSubevents, setLoadingSubevents] = useState(false);
  
  const tags = getFestivalTags(festival);
  const status = getFestivalStatus(festival);
  const startDate = new Date(festival.startDate);
  const endDate = new Date(festival.endDate);

  // Fetch subevents when expanded
  useEffect(() => {
    if (isExpanded && subevents.length === 0) {
      setLoadingSubevents(true);
      fetch(`/api/events?festivalId=${festival.id}`)
        .then(res => res.json())
        .then(data => {
          setSubevents(data);
          setLoadingSubevents(false);
        })
        .catch(err => {
          console.error('Error fetching subevents:', err);
          setLoadingSubevents(false);
        });
    }
  }, [isExpanded, festival.id, subevents.length]);

  // Fallback image with festival initials
  const getFallbackImage = () => {
    const initials = festival.title
      .split(' ')
      .map((word: string) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 3);
    
    return (
      <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-600 mb-2">{initials}</div>
          <div className="text-sm text-gray-500">Festival</div>
        </div>
      </div>
    );
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'live':
        return (
          <span className="bg-green-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-lg animate-pulse">
            LIVE NOW
          </span>
        );
      case 'upcoming':
        return (
          <span className="bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-lg">
            UPCOMING
          </span>
        );
      case 'past':
        return (
          <span className="bg-gray-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-lg">
            PAST
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden ${className}`}>
      {/* Image Section */}
      <div className="relative h-48 overflow-hidden">
        {festival.imageUrl && !imageError ? (
          <img
            src={festival.imageUrl}
            alt={festival.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          getFallbackImage()
        )}
        
        {/* Overlay with gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          {getStatusBadge()}
        </div>
        
        {/* Admin Edit Button */}
        {canEdit && (
          <Link 
            href={`/admin/events/new?edit=${festival.id}`}
            className="absolute top-4 left-4 bg-blue-500 text-white p-2 rounded-full shadow-sm hover:bg-blue-600 transition-colors z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <FaEdit className="w-4 h-4" />
          </Link>
        )}
        
        {/* Tags */}
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <span 
              key={i} 
              className={`px-2 py-1 text-xs font-medium rounded-full ${tag.color} ${
                tag.glow ? 'shadow-[0_0_10px_rgba(34,197,94,0.5)]' : ''
              }`}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-bold text-gray-900 line-clamp-2 leading-tight">
            {festival.title}
          </h3>
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FaExpand className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-3 leading-relaxed">
          {festival.description}
        </p>
        
        <div className="space-y-3 mb-4">
          <div className="flex items-center text-sm text-gray-500">
            <FaMapMarkerAlt className="w-4 h-4 mr-2 text-gray-400" />
            <span className="truncate">{festival.location}</span>
          </div>
          
          <div className="flex items-center text-sm text-gray-500">
            <FaCalendarAlt className="w-4 h-4 mr-2 text-gray-400" />
            <span>{formatFestivalDate(startDate)} - {formatFestivalDate(endDate)}</span>
          </div>
          
          <div className="flex items-center text-sm text-gray-500">
            <FaUsers className="w-4 h-4 mr-2 text-gray-400" />
            <span>{festival.subevents.length} events • {festival.rsvps?.length || 0} attendees</span>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <Link
            href={`/events/${festival.id}`}
            className="flex-1 bg-folio-accent text-white text-center py-2 px-4 rounded-lg hover:bg-folio-accent-dark transition-colors font-medium"
          >
            View Details
          </Link>
          
          {status === 'upcoming' && (
            <button className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium">
              RSVP
            </button>
          )}
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">Events in this Festival</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {loadingSubevents ? (
                <div className="text-sm text-gray-500 text-center py-4">Loading events...</div>
              ) : subevents.length > 0 ? (
                subevents.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <Link 
                      href={`/events/${sub.id}`} 
                      className="text-sm text-gray-700 hover:text-folio-accent transition-colors flex-1"
                    >
                      {sub.title}
                    </Link>
                    <span className="text-xs text-gray-500">
                      {formatFestivalDate(new Date(sub.startDate))}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  No events scheduled yet
                </div>
              )}
            </div>

            {/* EventStories Placeholder */}
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Stories</h4>
              <div className="flex overflow-x-auto space-x-4 pb-4">
                <div className="flex-shrink-0 w-64 h-36 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-sm">
                  <div className="text-center">
                    <div className="text-2xl mb-2">📱</div>
                    <div>No stories yet</div>
                    <div className="text-xs mt-1">Be the first to share!</div>
                  </div>
                </div>
                {/* TODO: integrate EventStories component */}
                {/* Future: map over actual stories */}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 