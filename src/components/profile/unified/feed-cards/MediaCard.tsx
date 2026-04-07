'use client';

import SafeImage from '@/components/SafeImage';

interface MediaCardProps {
  media: {
    id: string;
    title: string;
    type: string;
    thumbnailUrl?: string | null;
    sourceUrl?: string | null;
    duration?: number | null;
    views?: number;
    description?: string | null;
  };
}

export default function MediaCard({ media }: MediaCardProps) {
  const handleClick = () => {
    if (media.sourceUrl) {
      window.open(media.sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const isVideo = ['VIDEO', 'WEBINAR', 'SPEAKING', 'BEHIND_THE_SCENES'].includes(media.type);
  const isPodcast = media.type === 'PODCAST';

  return (
    <article
      onClick={handleClick}
      className="group block cursor-pointer overflow-hidden rounded-xl transition-all duration-300 hover:shadow-lg"
    >
      <div className="relative aspect-video overflow-hidden bg-folio-border-subtle">
        {media.thumbnailUrl ? (
          <SafeImage
            src={media.thumbnailUrl}
            alt={media.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${isPodcast ? 'bg-[#3D3A36]' : 'bg-folio-text-primary'}`}
          >
            {isPodcast ? <PodcastIcon /> : <VideoIcon />}
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}
          >
            {isPodcast ? (
              <HeadphonesIcon />
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="#2C2825"
                className="ml-1"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </div>

        {/* Duration badge */}
        {media.duration && (
          <div className="absolute bottom-3 right-3">
            <span
              className="px-2 py-1 text-xs font-medium rounded backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' }}
            >
              {formatDuration(media.duration)}
            </span>
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <span
            className="px-2 py-1 text-xs rounded-full backdrop-blur-sm"
            style={{
              backgroundColor: isPodcast ? 'rgba(59,130,246,0.9)' : 'rgba(239,68,68,0.9)',
              color: 'white',
            }}
          >
            {formatMediaType(media.type)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 bg-surface-canvas border-t border-folio-border-subtle">
        <h3
          className="font-medium leading-tight line-clamp-2 text-folio-text-primary"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {media.title}
        </h3>
        {media.description && (
          <p className="text-sm mt-2 line-clamp-2 text-folio-text-secondary">
            {media.description}
          </p>
        )}
        {media.views !== undefined && media.views > 0 && (
          <p className="text-xs mt-2" style={{ color: '#A09890' }}>
            {media.views.toLocaleString()} views
          </p>
        )}
      </div>
    </article>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hrs}:${remainMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatMediaType(type: string): string {
  const typeMap: Record<string, string> = {
    VIDEO: 'Video',
    PODCAST: 'Podcast',
    INTERVIEW: 'Interview',
    WEBINAR: 'Webinar',
    SPEAKING: 'Speaking',
    BEHIND_THE_SCENES: 'Behind the Scenes',
  };
  return typeMap[type] || type;
}

function VideoIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8B8178" strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polygon points="10,8 16,12 10,16" fill="#8B8178" />
    </svg>
  );
}

function PodcastIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8B8178" strokeWidth="1.5">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function HeadphonesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2C2825" strokeWidth="2">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}
