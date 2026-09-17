'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  initialExport?: { id: string; updatedAt?: string; config: any; headline?: string | null; bioText?: string | null; caption?: string | null } | null;
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

export function InstagramExportEditor({ project, designer, images, rooms, initialExport }: Props) {
  const saved = initialExport?.config || {};
  const [activeTab, setActiveTab] = useState<TabType>('format');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Format state
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(['1:1', '4:5', '9:16'].includes(saved.aspectRatio) ? saved.aspectRatio : '4:5');
  const [watermarkStyle, setWatermarkStyle] = useState<WatermarkStyle>(['folio_x', 'folio_presents', 'minimal'].includes(saved.watermarkStyle) ? saved.watermarkStyle : 'folio_x');
  const [headlinePosition, setHeadlinePosition] = useState<HeadlinePosition>(['bottom_left', 'bottom_center', 'top_left'].includes(saved.headlinePosition) ? saved.headlinePosition : 'bottom_left');
  const [slideCount, setSlideCount] = useState<3 | 4 | 5>([3, 4, 5].includes(saved.slideCount) ? saved.slideCount : 5);

  // Headline state
  const [quoteOptions, setQuoteOptions] = useState<string[]>([]);
  const [selectedHeadline, setSelectedHeadline] = useState(initialExport?.headline ?? saved.headline ?? '');
  const [quotesLoading, setQuotesLoading] = useState(false);

  // Designer/bio state
  const [bioEnabled, setBioEnabled] = useState(saved.bioEnabled !== false);
  const [bioOptions, setBioOptions] = useState<string[]>([]);
  const [selectedBio, setSelectedBio] = useState(initialExport?.bioText ?? saved.bioText ?? '');
  const [bioLoading, setBioLoading] = useState(false);

  // Caption state
  const [caption, setCaption] = useState(initialExport?.caption ?? '');
  const [captionLoading, setCaptionLoading] = useState(false);

  // Room selection
  const [selectedRoom, setSelectedRoom] = useState<string | null>(typeof saved.roomId === 'string' ? saved.roomId : null);

  const roomChanged = useRef(false);
  const headlineRequest = useRef(0);
  const captionRequest = useRef(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  // Image selection
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>(
    Array.isArray(saved.selectedImageUrls) ? saved.selectedImageUrls.filter((url: unknown): url is string => typeof url === 'string') : images.slice(0, 5).map((img) => img.url)
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

  const changeRoom = (roomId: string | null) => {
    if (roomId === selectedRoom) return;
    headlineRequest.current++;
    captionRequest.current++;
    roomChanged.current = true;
    setSelectedRoom(roomId);
    const roomName = rooms.find((room) => room.id === roomId)?.name;
    setSelectedImageUrls((roomId ? images.filter((img) => img.room === roomId || img.room === roomName) : images).slice(0, 5).map((img) => img.url));
    setActiveSlideIndex(0);
    setSelectedHeadline('');
    setQuoteOptions([]);
    setCaption('');
    setCaptionLoading(false);
    setGenerationError(null);
  };
  const safeSlideIndex = Math.min(activeSlideIndex, slides.length - 1);
  useEffect(() => { setActiveSlideIndex((index) => Math.min(index, slides.length - 1)); }, [slides.length]);

  const generateQuotes = useCallback(
    async (feedback?: string) => {
      const request = ++headlineRequest.current;
      setQuotesLoading(true);
      setGenerationError(null);
      try {
        const res = await fetch('/api/instagram-export/generate-headlines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            roomId: selectedRoom,
            feedback,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error('Could not generate headlines. Please try again.');
        if (request !== headlineRequest.current) return;
        if (data.headlines?.length) {
          setQuoteOptions(data.headlines);
          setSelectedHeadline((current: string) => current || data.headlines[0]);
        }
      } catch (error) {
        if (request === headlineRequest.current) setGenerationError(error instanceof Error ? error.message : 'Could not generate headlines.');
      } finally {
        if (request === headlineRequest.current) setQuotesLoading(false);
      }
    },
    [project.id, selectedRoom]
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
          setSelectedBio((current: string) => current || data.bios[0]);
        }
      } catch (error) {
        console.error('Failed to generate bio:', error);
      } finally {
        setBioLoading(false);
      }
    },
    [project.id, designer?.id]
  );

  const generateCaption = useCallback(async () => {
    if (!selectedHeadline) return;
    const request = ++captionRequest.current;
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
      if (!res.ok) throw new Error('Could not generate caption. Please try again.');
      if (request === captionRequest.current && data.caption) setCaption(data.caption);
    } catch (error) {
      if (request === captionRequest.current) setGenerationError(error instanceof Error ? error.message : 'Could not generate caption.');
    } finally {
      if (request === captionRequest.current) setCaptionLoading(false);
    }
  }, [project.id, selectedRoom, selectedHeadline]);

  useEffect(() => {
    if (!initialExport || roomChanged.current) generateQuotes();
    const requestState = headlineRequest;
    return () => { requestState.current++; };
  }, [generateQuotes, initialExport, selectedRoom]);
  useEffect(() => { if (!initialExport) generateBio(); }, [generateBio, initialExport]);

  // Auto-generate caption when headline is selected
  useEffect(() => {
    if (selectedHeadline && !caption && (!initialExport || roomChanged.current)) {
      generateCaption();
    }
  }, [selectedHeadline, caption, generateCaption, initialExport]);

  useEffect(() => {
    const requestState = captionRequest;
    return () => { requestState.current++; };
  }, []);

  // Tab auto-navigation: switch to relevant slide when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'headline') {
      setActiveSlideIndex(0); // Hero slide
    } else if (tab === 'designer') {
      const bioIdx = slides.findIndex((s) => s.type === 'bio');
      if (bioIdx >= 0) setActiveSlideIndex(bioIdx);
    } else if (tab === 'caption') {
      const ctaIdx = slides.findIndex((s) => s.type === 'cta');
      if (ctaIdx >= 0) setActiveSlideIndex(ctaIdx);
    }
  };

  const designerHandle = designer?.name?.toLowerCase().replace(/\s+/g, '') || 'designer';

  const tabs: { key: TabType; label: string }[] = [
    { key: 'format', label: 'Format' },
    { key: 'headline', label: 'Headline' },
    { key: 'designer', label: 'Bio' },
    { key: 'caption', label: 'Caption' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F4' }}>
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        borderBottom: '1px solid #E8E0D8',
        background: 'rgba(250,247,244,0.85)',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          minHeight: '64px',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link
              href={`/designer/studio?view=posts&project=${project.id}`}
              aria-label="Back to Publishing Studio"
              style={{ color: '#8B7B68', transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontFamily: "var(--font-headline)", fontSize: 'var(--type-h4)', fontStyle: 'italic', color: '#2C2420' }}>
                folio
              </span>
              <span style={{ color: '#D4C9BC', fontSize: 'var(--type-h4)', fontWeight: 200 }}>|</span> {/* folio-design-system: off-scale */}
              <span style={{ fontFamily: "'Helvetica Neue', sans-serif", fontSize: 'var(--type-meta)', letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase' as const, color: '#8B7B68' }}>
                Instagram carousel
              </span>
            </div>
          </div>

          <Link href={`/designer/projects/${project.id}`} style={{ color: '#8B7B68', fontSize: 'var(--type-meta)' }}>View project</Link>
          <ExportButton
            initialExport={initialExport}
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
        <div style={{ borderBottom: '1px solid #E8E0D8', background: '#FAF7F4' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px' }}>
            <button
              onClick={() => changeRoom(null)}
              style={{
                borderRadius: '20px',
                padding: '6px 16px',
                fontSize: 'var(--type-meta)',
                fontWeight: 'var(--w-h1)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: selectedRoom === null ? '#2C2420' : '#F0EBE4',
                color: selectedRoom === null ? '#FFFFFF' : '#8B7B68',
              }}
            >
              Full Project
            </button>
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => changeRoom(room.id)}
                style={{
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontSize: 'var(--type-meta)',
                  fontWeight: 'var(--w-h1)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: selectedRoom === room.id ? '#2C2420' : '#F0EBE4',
                  color: selectedRoom === room.id ? '#FFFFFF' : '#8B7B68',
                }}
              >
                {room.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main layout */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '32px',
        padding: '32px 16px',
        alignItems: 'flex-start',
      }}>
        {/* Left: Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '380px', minWidth: 0 }}>
          <SlidePreview
            aspectRatio={aspectRatio}
            slides={slides}
            activeIndex={safeSlideIndex}
            onSelectSlide={setActiveSlideIndex}
            headline={selectedHeadline}
            headlinePosition={headlinePosition}
            watermarkStyle={watermarkStyle}
            designerName={designer?.name || 'Designer'}
            designerTitle={designer?.title || undefined}
            studioName={designer?.studio || designer?.companyName || undefined}
            bioText={selectedBio}
            projectName={project.title}
            designerPhoto={designer?.profileImage || undefined}
            caption={caption}
            designerHandle={designerHandle}
          />
          <SlideThumbnails
            aspectRatio={aspectRatio}
            slides={slides}
            activeIndex={safeSlideIndex}
            onSelect={setActiveSlideIndex}
          />
        </div>

        {/* Right: Controls */}
        <div style={{ width: '100%', maxWidth: '380px', minWidth: 0 }}>
          {generationError && <p role="alert" style={{ marginBottom: '16px', color: '#A33' }}>{generationError}</p>}
          {/* Tab navigation */}
          <div style={{
            display: 'flex',
            gap: '4px',
            borderRadius: '12px',
            background: '#F0EBE4',
            padding: '4px',
            marginBottom: '24px',
          }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                style={{
                  flex: 1,
                  borderRadius: '8px',
                  padding: '8px 6px',
                  fontSize: 'var(--type-meta)',
                  fontWeight: 'var(--w-h1)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: activeTab === tab.key ? '#FFFFFF' : 'transparent',
                  color: activeTab === tab.key ? '#2C2420' : '#8B7B68',
                  boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{
            borderRadius: '16px',
            border: '1px solid #E8E0D8',
            background: '#FFFFFF',
            padding: '24px',
          }}>
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
