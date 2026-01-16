'use client';

import SafeImage from '@/components/SafeImage';

interface RecognitionCardProps {
  recognition: {
    id: string;
    title: string;
    type: string;
    source: string;
    sourceLogoUrl?: string | null;
    date: string | Date;
    url?: string | null;
    imageUrl?: string | null;
    excerpt?: string | null;
  };
}

export default function RecognitionCard({ recognition }: RecognitionCardProps) {
  const handleClick = () => {
    if (recognition.url) {
      window.open(recognition.url, '_blank', 'noopener,noreferrer');
    }
  };

  const isAward = recognition.type === 'AWARD';
  const date = new Date(recognition.date);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });

  return (
    <article
      onClick={handleClick}
      className={`group overflow-hidden rounded-xl transition-all duration-300 hover:shadow-lg ${
        recognition.url ? 'cursor-pointer' : ''
      }`}
      style={{ backgroundColor: 'white' }}
    >
      {/* Image section */}
      {recognition.imageUrl && (
        <div className="relative aspect-[16/9] overflow-hidden" style={{ backgroundColor: '#E8E4DF' }}>
          <SafeImage
            src={recognition.imageUrl}
            alt={recognition.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-5" style={{ borderTop: recognition.imageUrl ? '1px solid #E8E4DF' : 'none' }}>
        {/* Header with badge and source logo */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span
            className="px-2 py-1 text-xs rounded-full flex-shrink-0"
            style={{
              backgroundColor: isAward ? '#FEF3C7' : '#F0EDE9',
              color: isAward ? '#92400E' : '#6B635B',
            }}
          >
            {isAward && <span className="mr-1">&#127942;</span>}
            {formatRecognitionType(recognition.type)}
          </span>

          {recognition.sourceLogoUrl && (
            <div
              className="w-8 h-8 rounded flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: '#F5F3F0' }}
            >
              <SafeImage
                src={recognition.sourceLogoUrl}
                alt={recognition.source}
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Title */}
        <h3
          className="font-medium leading-tight line-clamp-2 mb-2"
          style={{ color: '#2C2825', fontFamily: 'Georgia, serif' }}
        >
          {recognition.title}
        </h3>

        {/* Source and date */}
        <div className="flex items-center gap-2 text-sm" style={{ color: '#8B8178' }}>
          <span className="font-medium">{recognition.source}</span>
          <span>·</span>
          <span>{formattedDate}</span>
        </div>

        {/* Excerpt */}
        {recognition.excerpt && (
          <p
            className="text-sm mt-3 line-clamp-3 italic"
            style={{ color: '#5C564F', borderLeft: '2px solid #E8E4DF', paddingLeft: '12px' }}
          >
            "{recognition.excerpt}"
          </p>
        )}

        {/* External link indicator */}
        {recognition.url && (
          <div className="mt-4 flex items-center gap-1 text-xs" style={{ color: '#8B8178' }}>
            <span>Read more</span>
            <ExternalLinkIcon />
          </div>
        )}
      </div>
    </article>
  );
}

function formatRecognitionType(type: string): string {
  const typeMap: Record<string, string> = {
    PRESS: 'Press',
    AWARD: 'Award',
    EDITORIAL: 'Editorial',
    SPEAKING: 'Speaking',
    CERTIFICATION: 'Certification',
  };
  return typeMap[type] || type;
}

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15,3 21,3 21,9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
