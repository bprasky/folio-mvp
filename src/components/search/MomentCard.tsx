'use client';

import { MomentResult } from '@/lib/search/searchMoments';
import Image from '@/components/FolioImage';

interface MomentCardProps {
  moment: MomentResult;
  onClick: () => void;
  onSave?: () => void;
  onShare?: () => void;
}

/**
 * Individual moment display
 * Image dominant with subtle attribution overlay on hover
 */
export default function MomentCard({
  moment,
  onClick,
  onSave,
  onShare,
}: MomentCardProps) {
  // Determine if moment is fully attributed (high tag completion)
  const isFullyAttributed = moment.tagCompletionScore >= 0.8;
  
  return (
    <div
      className="group relative aspect-[4/3] overflow-hidden cursor-pointer rounded-2xl transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_12px_32px_-8px_rgba(120,100,80,0.15)]"
      onClick={onClick}
    >
      {/* Image */}
      <div className="absolute inset-0">
        <Image
          src={moment.imageUrl}
          alt={moment.projectTitle}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105 rounded-2xl"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />
      </div>
      
      {/* Fully Attributed Badge */}
      {isFullyAttributed && (
        <div className="absolute top-2 left-2 z-10 bg-[#1A1A1A]/90 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Fully Attributed
        </div>
      )}
      
      {/* Attribution Overlay - Appears on Hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <p className="font-serif text-sm font-medium mb-1">
            {moment.projectTitle}
          </p>
          <p className="text-xs text-white/80">
            {moment.designerName}
          </p>
          {isFullyAttributed && (
            <p className="text-xs text-white/70 mt-1">
              ✓ All products tagged
            </p>
          )}
        </div>
      </div>
      
      {/* Save/Share Actions - Appear on Hover */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2">
        {onSave && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded text-xs font-medium hover:bg-white transition-colors"
          >
            Save
          </button>
        )}
        {onShare && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded text-xs font-medium hover:bg-white transition-colors"
          >
            Share
          </button>
        )}
      </div>
    </div>
  );
}

