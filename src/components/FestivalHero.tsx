'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FaEdit, FaPlus, FaCalendarAlt, FaMapMarkerAlt, FaHeart } from 'react-icons/fa';
import FestivalEditModal from './FestivalEditModal';

interface FestivalHeroProps {
  festival: {
    id: string;
    title: string;
    description: string;
    location: string;
    startDate: string;
    endDate: string;
    imageUrl?: string;
    createdBy: {
      id: string;
      name: string;
      companyName?: string;
    };
  };
  onFestivalUpdate: (updatedData: any) => void;
}

export default function FestivalHero({ festival, onFestivalUpdate }: FestivalHeroProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRSVPed, setIsRSVPed] = useState(false);

  const userRole = session?.user?.role || 'guest';
  const isAdmin = userRole === 'ADMIN';
  const formatDates = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${end.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
    } else {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  };

  const handleRSVP = () => {
    setIsRSVPed(!isRSVPed);
    // TODO: Implement actual RSVP functionality
  };

  const handleAddEvent = () => {
    router.push(`/events/create?festivalId=${festival.id}`);
  };

  return (
    <>
      {/* Hero Section */}
      <div className="relative w-full h-96 md:h-[500px] overflow-hidden rounded-lg mb-8">
        {/* Hero Image */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">         {festival.imageUrl ? (
            <img
              src={festival.imageUrl}
              alt={festival.title}
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl text-white/20">
              🎪
            </div>
          )}
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/20 to-transparent" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 md:p-8 text-white">
          <div className="max-w-4xl mx-auto">      {/* Festival Info */}
            <div className="mb-6">
              <h1 className="text-4xl md:text-6xl font-canela font-bold mb-4">
                {festival.title}
              </h1>
              <div className="flex flex-wrap items-center gap-6 text-lg md:text-xl">
                <div className="flex items-center gap-2">
                  <FaCalendarAlt className="text-folio-accent" />
                  <span>{formatDates(festival.startDate, festival.endDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FaMapMarkerAlt className="text-folio-accent" />
                  <span>{festival.location}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-3xl leading-relaxed">             {festival.description}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4">
              {/* RSVP Button */}
              <button
                onClick={handleRSVP}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  isRSVPed
                    ? 'bg-folio-accent text-white'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                }`}
              >
                <FaHeart className={isRSVPed ? 'text-white' : 'text-folio-accent'} />
                {isRSVPed ? 'RSVP\'d' : 'RSVP'}
              </button>

              {/* Admin Controls */}
              {isAdmin && (
                <>
                  <button
                    onClick={handleAddEvent}
                    className="flex items-center gap-2 px-6 py-3 bg-folio-accent text-white rounded-lg font-semibold hover:bg-folio-accent/90 transition-colors"
                  >
                    <FaPlus />
                    Add Event
                  </button>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 backdrop-blur-sm transition-colors"
                  >
                    <FaEdit />
                    Edit Festival
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Festival Edit Modal */}
      <FestivalEditModal
        festival={festival}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={onFestivalUpdate}
      />
    </>
  );
} 