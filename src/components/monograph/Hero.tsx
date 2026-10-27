import Image from '@/components/FolioImage';

interface HeroProps {
  imageUrl: string;
  title: string;
  locations: string[];
  establishedYear: number;
  followers: number;
  profileImageUrl?: string | null;
  children?: React.ReactNode;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export default function Hero({ imageUrl, title, locations, establishedYear, followers, profileImageUrl, children }: HeroProps) {
  return (
    <div className="relative w-full h-[70vh] min-h-[500px] max-h-[800px] overflow-hidden">
      {/* Hero Image */}
      <Image
        src={imageUrl}
        alt={title}
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />
      
      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      
      {/* Top Right Actions */}
      <div className="absolute top-8 right-8 z-10 flex flex-col items-end gap-2">
        <div className="bg-white/95 backdrop-blur-sm px-4 py-2 rounded border border-stone-200/50 shadow-sm">
          <div className="text-[var(--type-meta)] leading-tight" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6d6256', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
            <span className="text-[#b89a72] font-normal not-italic" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {formatNumber(followers)}
            </span>
            <span className="ml-1">Followers on Folio</span>
          </div>
        </div>
        {children}
      </div>
      
      {/* Content Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 lg:p-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end gap-5 mb-4">
            {profileImageUrl && (
              <Image
                src={profileImageUrl}
                alt={title}
                width={80}
                height={80}
                className="rounded-full object-cover ring-2 ring-white/30 shrink-0"
              />
            )}
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-white font-light leading-tight">
              {title}
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-white/90 text-sm md:text-base font-light">
            <span>{locations.join(' · ')}</span>
            <span className="text-white/60">•</span>
            <span>Est. {establishedYear}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
