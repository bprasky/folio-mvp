'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { SlidePreview } from './SlidePreview';
import { SlideThumbnails } from './SlideThumbnails';
import { FormatTab } from './FormatTab';
import { HeadlineTab } from './HeadlineTab';
import { DesignerTab } from './DesignerTab';
import { CaptionTab } from './CaptionTab';
import { ExportButton } from './ExportButton';
import type { AspectRatio } from '@/lib/instagram-export/generate-images';
import type { HeadlinePosition, WatermarkStyle } from '@/lib/instagram-export/svg-templates';

export type SlideType = 'hero' | 'detail' | 'bio' | 'cta';

export interface SlideData {
  type: SlideType;
  imageUrl?: string;
}

interface Props {
  project: {
    id: string;
    title: string;
    description: string | null;
    designerId: string | null;
    ownerId: string;
  };
  post: {
    id: string;
    slug: string;
    status: string;
    expandedBlocks: any;
    excerpt: string | null;
  };
  designer: {
    id: string;
    name: string;
    studio: string | null;
    companyName: string | null;
    title: string | null;
    bio: string | null;
    profileImage: string | null;
    specialties: string[];
  } | null;
  images: {
    id: string;
    url: string;
    name: string | null;
    room: string | null;
  }[];
  rooms: {
    id: string;
    name: string;
    type: string | null;
  }[];
}

export type TabType = 'format' | 'headline' | 'designer' | 'caption';

export function InstagramExportEditor({ project, post, designer, images, rooms }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('format');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Format state
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:5');
  const [watermarkStyle, setWatermarkStyle] = useState<WatermarkStyle>('folio_x');
  const [headlinePosition, setHeadlinePosition] = useState<HeadlinePosition>('bottom_left');
  const [slideCount, setSlideCount] = useState<3 | 4 | 5>(5);

  // Headline state
  const [quoteOptions, setQuoteOptions] = useState<string[]>([]);
  const [selectedHeadline, setSelectedHeadline] = useState('');
  const [quotesLoading, setQuotesLoading] = useState(false);

  // Designer/bio state
  const [bioEnabled, setBioEnabled] = useState(true);
  const [bioOptions, setBioOptions] = useState<string[]>([]);
  const [selectedBio, setSelectedBio] = useState('');
  const [bioLoading, setBioLoading] = useState(false);

  // Caption state
  const [caption, setCaption] = useState('');
  const [captionLoading, setCaptionLoading] = useState(false);

  // Room selection
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  // Image selection
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>(
    images.slice(0, 5).map((img) => img.url)
  );

  // Build slide sequence
  const slides: SlideData[] = (() => {
    const result: SlideData[] = [];
    const available = selectedImageUrls;

    if (available[0]) result.push({ type: 'hero', imageUrl: available[0] });

    const detailCount = slideCount - 1 - (bioEnabled ? 1 : 0) - 1;
    const detailImages = available.slice(1);
    const firstHalf = Math.ceil(detailCount / 2);
    const secondHalf = detailCount - firstHalf;

    for (let i = 0; i < firstHalf; i++) {
      if (detailImages[i]) result.push({ type: 'detail', imageUrl: detailImages[i] });
    }

    if (bioEnabled) result.push({ type: 'bio' });

    for (let i = firstHalf; i < firstHalf + secondHalf; i++) {
      if (detailImages[i]) result.push({ type: 'detail', imageUrl: detailImages[i] });
    }

    result.push({ type: 'cta' });
    return result;
  })();

  // Filter images by room
  const filteredImages = selectedRoom
    ? images.filter((img) => img.room === selectedRoom || img.room === rooms.find((r) => r.id === selectedRoom)?.name)
    : images;

  // Auto-generate on mount
  useEffect(() => {
    generateQuotes();
    generateBio();
  }, []);

  // Regenerate when room changes
  useEffect(() => {
    if (selectedRoom !== null) {
      generateQuotes();
      // Update selected images based on room
      const roomImages = filteredImages.slice(0, 5).map((img) => img.url);
      if (roomImages.length > 0) setSelectedImageUrls(roomImages);
    }
  }, [selectedRoom]);

  const generateQuotes = useCallback(
    async (feedback?: string) => {
      setQuotesLoading(true);
      try {
        const res = await fetch('/api/instagram-export/generate-quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            roomId: selectedRoom,
            feedback,
          }),
        });
        const data = await res.json();
        if (data.quotes?.length) {
          setQuoteOptions(data.quotes);
          if (!selectedHeadline) setSelectedHeadline(data.quotes[0]);
        }
      } catch (error) {
        console.error('Failed to generate quotes:', error);
      } finally {
        setQuotesLoading(false);
      }
    },
    [project.id, selectedRoom, selectedHeadline]
  );

  const generateBio = useCallback(
    async (feedback?: string) => {
      setBioLoading(true);
      try {
        const res = await fetch('/api/instagram-export/generate-bio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            designerId: designer?.id,
            feedback,
          }),
        });
        const data = await res.json();
        if (data.bios?.length) {
          setBioOptions(data.bios);
          if (!selectedBio) setSelectedBio(data.bios[0]);
        }
      } catch (error) {
        console.error('Failed to generate bio:', error);
      } finally {
        setBioLoading(false);
      }
    },
    [project.id, designer?.id, selectedBio]
  );

  const generateCaption = useCallback(async () => {
    if (!selectedHeadline) return;
    setCaptionLoading(true);
    try {
      const res = await fetch('/api/instagram-export/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          roomId: selectedRoom,
          headline: selectedHeadline,
        }),
      });
      const data = await res.json();
      if (data.caption) setCaption(data.caption);
    } catch (error) {
      console.error('Failed to generate caption:', error);
    } finally {
      setCaptionLoading(false);
    }
  }, [project.id, selectedRoom, selectedHeadline]);

  // Auto-generate caption when headline is selected
  useEffect(() => {
    if (selectedHeadline && !caption) {
      generateCaption();
    }
  }, [selectedHeadline]);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'format', label: 'Format' },
    { key: 'headline', label: 'Headline' },
    { key: 'designer', label: 'Designer' },
    { key: 'caption', label: 'Caption' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F4]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#E8E0D8] bg-[#FAF7F4]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/p/${post.slug}`}
              className="text-[#8B7B68] transition-colors hover:text-[#2C2420]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M12.5 15L7.5 10L12.5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-[15px] font-medium text-[#2C2420]">
                Share to Instagram
              </h1>
              <p className="text-[13px] text-[#8B7B68]">{project.title}</p>
            </div>
          </div>

          <ExportButton
            projectId={project.id}
            config={{
              aspectRatio,
              watermarkStyle,
              headlinePosition,
              headline: selectedHeadline,
              bioEnabled,
              bioText: selectedBio,
              slideCount,
              selectedImageUrls,
              roomId: selectedRoom || undefined,
            }}
            caption={caption}
          />
        </div>
      </header>

      {/* Room selector */}
      {rooms.length > 1 && (
        <div className="border-b border-[#E8E0D8] bg-[#FAF7F4]">
          <div className="mx-auto flex max-w-7xl gap-2 px-6 py-3">
            <button
              onClick={() => setSelectedRoom(null)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                selectedRoom === null
                  ? 'bg-[#2C2420] text-white'
                  : 'bg-[#F0EBE4] text-[#8B7B68] hover:bg-[#E8E0D8]'
              }`}
            >
              Full Project
            </button>
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                  selectedRoom === room.id
                    ? 'bg-[#2C2420] text-white'
                    : 'bg-[#F0EBE4] text-[#8B7B68] hover:bg-[#E8E0D8]'
                }`}
              >
                {room.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8">
        {/* Left: Preview */}
        <div className="flex-1">
          <SlidePreview
            slide={slides[activeSlideIndex]}
            aspectRatio={aspectRatio}
            headline={selectedHeadline}
            headlinePosition={headlinePosition}
            watermarkStyle={watermarkStyle}
            designerName={designer?.name || 'Designer'}
            designerTitle={designer?.title || undefined}
            studioName={designer?.studio || designer?.companyName || undefined}
            bioText={selectedBio}
            projectName={project.title}
            designerPhoto={designer?.profileImage || undefined}
          />
          <SlideThumbnails
            slides={slides}
            activeIndex={activeSlideIndex}
            onSelect={setActiveSlideIndex}
          />
        </div>

        {/* Right: Controls */}
        <div className="w-[380px] shrink-0">
          {/* Tab navigation */}
          <div className="mb-6 flex gap-1 rounded-xl bg-[#F0EBE4] p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-white text-[#2C2420] shadow-sm'
                    : 'text-[#8B7B68] hover:text-[#2C2420]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
            {activeTab === 'format' && (
              <FormatTab
                aspectRatio={aspectRatio}
                setAspectRatio={setAspectRatio}
                watermarkStyle={watermarkStyle}
                setWatermarkStyle={setWatermarkStyle}
                headlinePosition={headlinePosition}
                setHeadlinePosition={setHeadlinePosition}
                slideCount={slideCount}
                setSlideCount={setSlideCount}
                images={filteredImages}
                selectedImageUrls={selectedImageUrls}
                setSelectedImageUrls={setSelectedImageUrls}
              />
            )}

            {activeTab === 'headline' && (
              <HeadlineTab
                quoteOptions={quoteOptions}
                selectedHeadline={selectedHeadline}
                setSelectedHeadline={setSelectedHeadline}
                loading={quotesLoading}
                onRegenerate={generateQuotes}
              />
            )}

            {activeTab === 'designer' && (
              <DesignerTab
                bioEnabled={bioEnabled}
                setBioEnabled={setBioEnabled}
                bioOptions={bioOptions}
                selectedBio={selectedBio}
                setSelectedBio={setSelectedBio}
                loading={bioLoading}
                onRegenerate={generateBio}
                designerName={designer?.name || 'Designer'}
              />
            )}

            {activeTab === 'caption' && (
              <CaptionTab
                caption={caption}
                setCaption={setCaption}
                loading={captionLoading}
                onRegenerate={generateCaption}
                projectTitle={project.title}
                designerName={designer?.name || 'Designer'}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
