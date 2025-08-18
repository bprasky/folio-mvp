import React from 'react';
import { FaMapMarkerAlt, FaCalendarAlt, FaClock, FaUsers, FaUtensils, FaStar, FaEdit } from 'react-icons/fa';
import Link from 'next/link';
import clsx from 'clsx';

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    location: string;
    isVirtual: boolean;
    imageUrl?: string;
    promotionTier: number;
    eventTypes: string[];
    includesFood: boolean;
    capacity?: number;
    rsvps?: any[];
    createdBy?: {
      name: string;
      profileImage?: string;
    };
    eventTags?: string[];
    designStyles?: string[];
    isSponsored?: boolean;
    allowChat?: boolean;
  };
  onClick?: () => void;
  className?: string;
  userRole?: string;
  getEventTypeIcon?: (type: string) => React.ReactNode;
  getBuzzBadges?: (event: any) => string[];
  formatDate?: (dateString: string) => string;
  formatTime?: (dateString: string) => string;
  userRSVPs?: any[];
}

export default function EventCard({ event, onClick, className, userRole }: EventCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getEventTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'PANEL': 'bg-blue-100 text-blue-800',
      'PRODUCT_REVEAL': 'bg-purple-100 text-purple-800',
      'HAPPY_HOUR': 'bg-yellow-100 text-yellow-800',
      'LUNCH_AND_LEARN': 'bg-green-100 text-green-800',
      'INSTALLATION': 'bg-indigo-100 text-indigo-800',
      'EXHIBITION': 'bg-pink-100 text-pink-800',
      'BOOTH': 'bg-orange-100 text-orange-800',
      'PARTY': 'bg-red-100 text-red-800',
      'MEAL': 'bg-emerald-100 text-emerald-800',
      'TOUR': 'bg-teal-100 text-teal-800',
      'AWARDS': 'bg-amber-100 text-amber-800',
      'WORKSHOP': 'bg-cyan-100 text-cyan-800',
      'KEYNOTE': 'bg-violet-100 text-violet-800',
      'OTHER': 'bg-gray-100 text-gray-800',
      'FESTIVAL': 'bg-purple-100 text-purple-800'
    };
    return colors[type] || colors['OTHER'];
  };

  const rsvpCount = event.rsvps?.length || 0;
  const isAtCapacity = event.capacity && rsvpCount >= event.capacity;

  return (
    <div
      className={clsx(
        "rounded-xl border border-gray-200 shadow-sm p-4 transition-all duration-300 hover:shadow-md cursor-pointer bg-white relative",
        {
          // Dynamic sizing based on promotion tier
          "col-span-4 row-span-2": event.promotionTier === 2, // Full-width featured
          "col-span-2 row-span-2": event.promotionTier === 1, // Medium boosted
          "col-span-1": event.promotionTier === 0,            // Standard
        },
        className
      )}
      onClick={onClick}
    >
      {/* Admin Edit Icon */}
      {userRole === 'ADMIN' && (
        <Link href={`/admin/events/new?edit=${event.id}`} onClick={(e) => e.stopPropagation()}>
          <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-sm hover:bg-blue-600 transition-colors z-20">
            <FaEdit className="w-3 h-3" />
          </div>
        </Link>
      )}

      {/* Featured indicator for sponsored events */}
      {event.isSponsored && (
        <div className="absolute top-2 right-2 z-10">
          <FaStar className="text-yellow-500 w-4 h-4" />
        </div>
      )}

      {/* Event Image */}
      <div className="relative mb-3">
        <img 
          src={event.imageUrl || '/images/event-placeholder.jpg'} 
          alt={event.title}
          className={clsx(
            "w-full object-cover rounded-lg",
            {
              "h-64": event.promotionTier === 2, // Featured: larger image
              "h-48": event.promotionTier === 1, // Boosted: medium image
              "h-32": event.promotionTier === 0, // Standard: smaller image
            }
          )}
        />
        
        {/* Virtual indicator overlay */}
        {event.isVirtual && (
          <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium">
            Virtual
          </div>
        )}

        {/* Capacity indicator */}
        {isAtCapacity && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
            Full
          </div>
        )}

        {/* Chat indicator */}
        {event.allowChat && (
          <div className="absolute bottom-2 right-2 bg-green-500 text-white p-1 rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Event Title */}
      <h3 className={clsx(
        "font-semibold text-folio-text mb-1 line-clamp-2",
        {
          "text-xl": event.promotionTier >= 1,
          "text-lg": event.promotionTier === 0,
        }
      )}>
        {event.title}
      </h3>

      {/* Date and Time */}
      <div className="flex items-center text-sm text-gray-500 mb-2">
        <FaCalendarAlt className="mr-1" />
        <span>{formatDate(event.startDate)}</span>
        <FaClock className="ml-2 mr-1" />
        <span>{formatTime(event.startDate)}</span>
      </div>

      {/* Location */}
      <div className="flex items-center text-sm text-gray-500 mb-3">
        <FaMapMarkerAlt className="mr-1" />
        <span className="truncate">{event.location}</span>
      </div>

      {/* Event Type Badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        {event.eventTypes.slice(0, event.promotionTier >= 1 ? 3 : 2).map((type) => (
          <span 
            key={type} 
            className={clsx(
              "px-2 py-1 rounded-full text-xs font-medium",
              getEventTypeColor(type)
            )}
          >
            {type.replace("_", " ")}
          </span>
        ))}
        
        {/* Food indicator */}
        {event.includesFood && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <FaUtensils className="mr-1" />
            Food/Drink
          </span>
        )}

        {/* Show more types indicator for featured events */}
        {event.promotionTier >= 1 && event.eventTypes.length > 3 && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            +{event.eventTypes.length - 3} more
          </span>
        )}
      </div>

      {/* Description for larger cards */}
      {event.promotionTier >= 1 && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-3">
          {event.description}
        </p>
      )}

      {/* Design Styles for featured events */}
      {event.promotionTier === 2 && event.designStyles && event.designStyles.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Design Styles:</div>
          <div className="flex flex-wrap gap-1">
            {event.designStyles.slice(0, 4).map((style) => (
              <span key={style} className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {style}
              </span>
            ))}
            {event.designStyles.length > 4 && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                +{event.designStyles.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Event Tags for featured events */}
      {event.promotionTier === 2 && event.eventTags && event.eventTags.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Tags:</div>
          <div className="flex flex-wrap gap-1">
            {event.eventTags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-2 py-1 rounded-full text-xs font-medium bg-folio-accent text-white">
                {tag}
              </span>
            ))}
            {event.eventTags.length > 3 && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                +{event.eventTags.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bottom section with RSVP count and creator */}
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center text-sm text-gray-500">
          <FaUsers className="mr-1" />
          <span>{rsvpCount}</span>
          {event.capacity && (
            <span className="ml-1">/ {event.capacity}</span>
          )}
        </div>

        {/* Creator info for larger cards */}
        {event.promotionTier >= 1 && event.createdBy && (
          <div className="flex items-center">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center mr-2">
              {event.createdBy.profileImage ? (
                <img 
                  src={event.createdBy.profileImage} 
                  alt={event.createdBy.name} 
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-medium text-gray-600">
                  {event.createdBy.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-600">{event.createdBy.name}</span>
          </div>
        )}
      </div>

      {/* Promotion tier indicator */}
      {event.promotionTier > 0 && (
        <div className={clsx(
          "absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium text-white",
          {
            "bg-yellow-500": event.promotionTier === 1,
            "bg-purple-500": event.promotionTier === 2,
          }
        )}>
          {event.promotionTier === 1 ? "Boosted" : "Featured"}
        </div>
      )}
    </div>
  );
} 