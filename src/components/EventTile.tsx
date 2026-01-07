import Link from 'next/link';
import { useState } from 'react';
import { FaCalendarAlt, FaMapMarkerAlt, FaUser, FaHeart, FaCheck, FaStar, FaFire, FaCrown, FaEdit } from 'react-icons/fa';
import { Event } from '../lib/fetchEvents';
import { TileSize, getTileGridClasses, getHoverAnimationClasses, getTypographyClasses } from '../lib/fibonacciUtils';

interface EventTileProps {
  event: Event;
  size: TileSize;
  getEventTypeIcon: (type: string) => string;
  getBuzzBadges: (event: Event) => { label: string; color: string }[];
  formatDate: (dateString: string) => string;
  formatTime: (dateString: string) => string;
  userRSVPs?: any[];
  className?: string;
  gridArea?: string;
  userRole?: string;
  canEdit?: boolean;
}

export default function EventTile({
  event,
  size,
  getEventTypeIcon,
  getBuzzBadges,
  formatDate,
  formatTime,
  userRSVPs = [],
  className = '',
  gridArea,
  userRole,
  canEdit = false
}: EventTileProps) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Compute whether to show the edit affordance (child events only)
  const showEdit = Boolean(canEdit) && !(event.eventTypes ?? []).some(t => String(t) === "FESTIVAL");
  
  const badges = getBuzzBadges ? getBuzzBadges(event) : [];
  const typography = getTypographyClasses(size);
  const isRSVPed = userRSVPs.some(rsvp => rsvp.eventId === event.id);
  const rsvpCount = event.rsvps?.length || 0;

  const handleImageError = () => {
    setImageError(true);
  };

  const getImageHeight = () => {
    switch (size) {
      case 'XL': return 'h-64';
      case 'L': return 'h-48';
      case 'M': return 'h-40';
      case 'S': return 'h-32';
    }
  };

  const getBadgePosition = () => {
    switch (size) {
      case 'XL': return 'top-4 left-4';
      case 'L': return 'top-3 left-3';
      case 'M': return 'top-2 left-2';
      case 'S': return 'top-2 left-2';
    }
  };

  return (
    <div
      className={`
        relative bg-white rounded-xl overflow-hidden border border-gray-100
        ${getHoverAnimationClasses(size)}
        ${getTileGridClasses(size)}
        ${className}
      `}
      style={{ gridArea }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Absolute link overlay at z-0 */}
      <Link href={`/events/${event.id}`} className="absolute inset-0 z-0" aria-label={event.title} />
      
      {/* Edit button - only when showEdit */}
      {showEdit && (
        <div className="absolute right-2 top-2 z-10 pointer-events-auto">
          <Link
            href={`/admin/events/new?edit=${event.id}`}
            className="inline-flex items-center gap-1 rounded-full bg-black/70 text-white px-2 py-1 text-xs hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-white"
            title="Edit event"
            data-testid="edit-event"
          >
            ✎ Edit
          </Link>
        </div>
      )}
        {/* Image Container */}
        <div className={`relative ${getImageHeight()} overflow-hidden`}>
          {!imageError && event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover transition-transform duration-300"
              style={{
                transform: isHovered ? 'scale(1.05)' : 'scale(1)'
              }}
              onError={handleImageError}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <div className="text-gray-400 text-center">
                <div className="text-3xl mb-2">🎭</div>
                <div className="text-xs">No Image</div>
              </div>
            </div>
          )}
          
          {/* Badges */}
          <div className={`absolute ${getBadgePosition()} flex flex-wrap gap-1`}>
            {badges.slice(0, size === 'S' ? 1 : 2).map((badge, index) => (
              <span
                key={index}
                className={`
                  px-2 py-1 text-xs font-medium rounded-full shadow-sm
                  ${badge.color}
                  backdrop-blur-sm bg-opacity-90
                `}
              >
                {badge.label}
              </span>
            ))}
          </div>

          {/* RSVP Status Overlay */}
          {isRSVPed && (
            <div className="absolute top-2 right-2">
              <div className="bg-green-500 text-white p-1 rounded-full shadow-sm">
                <FaCheck className="w-3 h-3" />
              </div>
            </div>
          )}


        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className={`${typography.title} text-gray-900 line-clamp-2 leading-tight`}>
            {event.title}
          </h3>

          {/* Description - only show for larger tiles */}
          {(size === 'XL' || size === 'L') && event.description && (
            <p className={`${typography.description} text-gray-600 line-clamp-2`}>
              {event.description}
            </p>
          )}

          {/* Event Details */}
          <div className="space-y-2">
            {/* Date and Time */}
            <div className="flex items-center text-gray-500">
              <FaCalendarAlt className={`${typography.date} mr-2 flex-shrink-0`} />
              <span className={`${typography.date}`}>
                {formatDate(event.startDate.toString())}
                {event.startDate !== event.endDate && ` - ${formatDate(event.endDate.toString())}`}
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center text-gray-500">
              <FaMapMarkerAlt className={`${typography.location} mr-2 flex-shrink-0`} />
              <span className={`${typography.location} line-clamp-1`}>
                {event.location}
              </span>
            </div>

            {/* RSVP Count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center text-gray-500">
                <FaUser className={`${typography.date} mr-2 flex-shrink-0`} />
                <span className={`${typography.date}`}>
                  {rsvpCount} {rsvpCount === 1 ? 'RSVP' : 'RSVPs'}
                </span>
              </div>
              
              {/* Event Type Icon */}
              <div className="flex items-center text-gray-400">
                <span className={`${typography.date} mr-1`}>
                  {getEventTypeIcon ? getEventTypeIcon(event.eventTypes?.[0] || 'other') : '🎭'}
                </span>
                <span className={`${typography.date} capitalize`}>
                  {event.eventTypes?.[0] || 'other'}
                </span>
              </div>
            </div>
          </div>

          {/* Festival Badge - only show for larger tiles */}
          {(size === 'XL' || size === 'L') && event.parentFestival && (
            <div className="pt-2 border-t border-gray-100">
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-folio-accent bg-folio-accent/10 rounded-full">
                {event.parentFestival.title}
              </span>
            </div>
          )}
        </div>

        {/* Hover Overlay */}
        <div
          className={`
            absolute inset-0 bg-black bg-opacity-0 transition-all duration-300
            flex items-center justify-center
            ${isHovered ? 'bg-opacity-10' : ''}
          `}
        >
          {isHovered && (
            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
              <span className="text-sm font-medium text-gray-900">View Details</span>
            </div>
          )}
        </div>
      </div>
  );
}