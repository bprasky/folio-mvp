'use client';

import SafeImage from '@/components/SafeImage';

interface MediaCardProps {
  media: {
    id: string;
    type: string;
    title: string;
    thumbnailUrl?: string | null;
    duration?: number | null;
    views?: number;
  };
}

export default function MediaCard({ media }: MediaCardProps) {
  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      VIDEO: 'Video',
      PODCAST: 'Podcast',
      INTERVIEW: 'Interview',
      WEBINAR: 'Webinar',
      SPEAKING: 'Talk',
      BEHIND_THE_SCENES: 'BTS',
    };
    return labels[type] || 'Media';
  };

  return (
    <div className="group cursor-pointer">
      <div
        className="rounded-lg overflow-hidden relative"
        style={{ backgroundColor: '#E8E4DF', aspectRatio: '16/9' }}
      >
        {media.thumbnailUrl && (
          <SafeImage
            src={media.thumbnailUrl}
            alt={media.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm transition-transform group-hover:scale-110"
            style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
          >
            <span className="text-lg ml-1" style={{ color: '#2C2825' }}>
              ▶
            </span>
          </div>
        </div>

        {/* Badge */}
        <div className="absolute top-3 left-3">
          <span
            className="px-2 py-1 text-xs rounded-full backdrop-blur-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.8)', color: '#6B635B' }}
          >
            {getTypeLabel(media.type)}
          </span>
        </div>

        {/* Duration */}
        {media.duration && (
          <div className="absolute bottom-3 right-3">
            <span
              className="px-2 py-1 text-xs rounded backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
            >
              {formatDuration(media.duration)}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="mt-3">
        <p
          className="text-sm font-medium group-hover:underline"
          style={{ color: '#2C2825' }}
        >
          {media.title}
        </p>
        {media.views !== undefined && media.views > 0 && (
          <p className="text-xs mt-1" style={{ color: '#8B8178' }}>
            {media.views.toLocaleString()} views
          </p>
        )}
      </div>
    </div>
  );
}
