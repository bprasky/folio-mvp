'use client';

import { MomentResult } from '@/lib/search/searchMoments';
import Image from 'next/image';
import Link from 'next/link';

interface MomentExpandedProps {
  moment: MomentResult;
  onClose: () => void;
  onSave?: () => void;
  onShare?: () => void;
}

/**
 * Expanded view when moment is clicked
 * Shows: larger image, designer info, tagged products
 */
export default function MomentExpanded({
  moment,
  onClose,
  onSave,
  onShare,
}: MomentExpandedProps) {
  return (
    <div className="fixed inset-0 z-50 glass-backdrop flex items-center justify-center p-8">
      <div className="bg-white max-w-6xl w-full max-h-[90vh] overflow-y-auto rounded-lg relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm w-10 h-10 rounded-full flex items-center justify-center hover:bg-white transition-colors"
        >
          <span className="text-2xl">×</span>
        </button>
        
        <div className="grid md:grid-cols-2 gap-0">
          {/* Image */}
          <div className="relative aspect-[4/3] bg-surface-elevated">
            <Image
              src={moment.imageUrl}
              alt={moment.projectTitle}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          
          {/* Details */}
          <div className="p-8">
            <h2 className="font-serif text-3xl mb-4 text-folio-text-primary">
              {moment.projectTitle}
            </h2>
            
            {/* Designer Info */}
            <div className="mb-6">
              <Link
                href={`/profile/${moment.designerId}`}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                {moment.designerProfileImage && (
                  <Image
                    src={moment.designerProfileImage}
                    alt={moment.designerName}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium text-folio-text-primary">
                    {moment.designerName}
                  </p>
                  <p className="text-sm text-[#666]">Designer</p>
                </div>
              </Link>
            </div>
            
            {/* Tagged Products */}
            {moment.products.length > 0 && (
              <div className="mb-6">
                <h3 className="font-serif text-lg mb-3 text-folio-text-primary">
                  Products
                </h3>
                <div className="space-y-2">
                  {moment.products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between py-2 border-b border-folio-border-subtle"
                    >
                      <span className="text-folio-text-primary">{product.name}</span>
                      {product.vendorName && (
                        <span className="text-sm text-[#666]">
                          {product.vendorName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Tags */}
            {moment.tags.length > 0 && (
              <div className="mb-6">
                <h3 className="font-serif text-lg mb-3 text-folio-text-primary">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {moment.tags.slice(0, 10).map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-surface-elevated rounded-full text-sm text-[#666]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-3 pt-6 border-t border-folio-border-subtle">
              <Link
                href={`/project/${moment.projectId}?image=${moment.id}`}
                className="flex-1 bg-[#1A1A1A] text-white px-6 py-3 rounded text-center font-medium hover:bg-[#333] transition-colors"
              >
                View Project
              </Link>
              {onSave && (
                <button
                  onClick={onSave}
                  className="px-6 py-3 border border-folio-border-subtle rounded font-medium hover:bg-surface-elevated transition-colors"
                >
                  Save
                </button>
              )}
              {onShare && (
                <button
                  onClick={onShare}
                  className="px-6 py-3 border border-folio-border-subtle rounded font-medium hover:bg-surface-elevated transition-colors"
                >
                  Share
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

