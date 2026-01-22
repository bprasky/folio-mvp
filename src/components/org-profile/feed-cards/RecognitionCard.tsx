'use client';

import SafeImage from '@/components/SafeImage';

interface RecognitionCardProps {
  recognition: {
    id: string;
    type: string;
    title: string;
    source: string;
    sourceLogoUrl?: string | null;
    imageUrl?: string | null;
    date: string;
    url?: string | null;
    excerpt?: string | null;
  };
}

export default function RecognitionCard({ recognition }: RecognitionCardProps) {
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      PRESS: 'Press',
      AWARD: 'Award',
      EDITORIAL: 'Editorial',
      SPEAKING: 'Speaking',
      CERTIFICATION: 'Certification',
    };
    return labels[type] || 'Recognition';
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const CardWrapper = recognition.url ? 'a' : 'div';
  const wrapperProps = recognition.url
    ? { href: recognition.url, target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <CardWrapper {...wrapperProps} className="block group cursor-pointer">
      <div
        className="rounded-lg overflow-hidden p-4 transition-all group-hover:shadow-md"
        style={{ backgroundColor: '#F5F3F0', border: '1px solid #E8E4DF' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {recognition.sourceLogoUrl ? (
            <div
              className="w-10 h-10 rounded overflow-hidden flex-shrink-0"
              style={{ backgroundColor: '#E8E4DF' }}
            >
              <SafeImage
                src={recognition.sourceLogoUrl}
                alt={recognition.source}
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
          ) : (
            <div
              className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0 text-xs font-medium"
              style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
            >
              {recognition.source.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
            >
              {getTypeLabel(recognition.type)}
            </span>
            <p
              className="text-xs mt-1 truncate"
              style={{ color: '#8B8178' }}
            >
              {recognition.source} · {formatDate(recognition.date)}
            </p>
          </div>
        </div>

        {/* Image if present */}
        {recognition.imageUrl && (
          <div
            className="rounded overflow-hidden mb-3 relative"
            style={{ aspectRatio: '16/9' }}
          >
            <SafeImage
              src={recognition.imageUrl}
              alt={recognition.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Title & Excerpt */}
        <h4
          className="text-sm font-medium group-hover:underline"
          style={{ color: '#2C2825' }}
        >
          {recognition.title}
        </h4>
        {recognition.excerpt && (
          <p
            className="text-xs mt-2 line-clamp-2"
            style={{ color: '#6B635B' }}
          >
            {recognition.excerpt}
          </p>
        )}
      </div>
    </CardWrapper>
  );
}
