'use client';

import SafeImage from '@/components/SafeImage';

interface CollaborationCardProps {
  collaboration: {
    id: string;
    type: string;
    title: string;
    description?: string | null;
    partnerName?: string | null;
    partnerLogoUrl?: string | null;
    imageUrl?: string | null;
  };
}

export default function CollaborationCard({ collaboration }: CollaborationCardProps) {
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      FORMAL_PARTNERSHIP: 'Partnership',
      PROJECT: 'Project',
      PRODUCT_FEATURE: 'Product Feature',
      JOINT_VENTURE: 'Joint Venture',
    };
    return labels[type] || 'Collaboration';
  };

  return (
    <div className="group cursor-pointer">
      <div
        className="rounded-lg overflow-hidden transition-all group-hover:shadow-md"
        style={{ backgroundColor: '#F5F3F0', border: '1px solid #E8E4DF' }}
      >
        {/* Image */}
        {collaboration.imageUrl && (
          <div
            className="relative overflow-hidden"
            style={{ aspectRatio: '16/9' }}
          >
            <SafeImage
              src={collaboration.imageUrl}
              alt={collaboration.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {/* Badge & Partner */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
            >
              {getTypeLabel(collaboration.type)}
            </span>
            {collaboration.partnerName && (
              <span className="text-xs" style={{ color: '#8B8178' }}>
                with {collaboration.partnerName}
              </span>
            )}
          </div>

          {/* Partner Logo */}
          {collaboration.partnerLogoUrl && (
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-6 h-6 rounded overflow-hidden"
                style={{ backgroundColor: '#E8E4DF' }}
              >
                <SafeImage
                  src={collaboration.partnerLogoUrl}
                  alt={collaboration.partnerName || 'Partner'}
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
            </div>
          )}

          {/* Title & Description */}
          <h4
            className="text-sm font-medium group-hover:underline"
            style={{ color: '#2C2825' }}
          >
            {collaboration.title}
          </h4>
          {collaboration.description && (
            <p
              className="text-xs mt-2 line-clamp-2"
              style={{ color: '#6B635B' }}
            >
              {collaboration.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
