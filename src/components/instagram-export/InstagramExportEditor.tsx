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
  studioScope?: 'all' | 'project';
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
    roomId?: string | null;
  }[];
  rooms: {
    id: string;
    name: string;
    type: string | null;
  }[];
}

export type TabType = 'format' | 'headline' | 'designer' | 'caption';

export function InstagramExportEditor({ project, designer, images, rooms, initialExport, studioScope = 'project' }: Props) {
  const saved = initialExport?.config || {};
  const [activeTab, setActiveTab] = useState<TabType>('caption');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Format state
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(['1:1', '4:5', '9:16'].includes(saved.aspectRatio) ? saved.aspectRatio : '4:5');
  const [watermarkStyle, setWatermarkStyle] = useState<WatermarkStyle>(['folio_x', 'folio_presents', 'minimal'].includes(saved.watermarkStyle) ? saved.watermarkStyle : 'folio_x');
  const [headlinePosition, setHeadlinePosition] = useState<HeadlinePosition>(['bottom_left', 'bottom_center', 'top_left'].includes(saved.headlinePosition) ? saved.headlinePosition : 'bottom_left');
  const [slideCount, setSlideCount] = useState<2 | 3 | 4 | 5>([2, 3, 4, 5].includes(saved.slideCount) ? (saved.slideCount === 2 && saved.bioEnabled !== false ? 3 : saved.slideCount) : 5);

  // Headline state
  const [quoteOptions, setQuoteOptions] = useState<string[]>(Array.isArray(saved.headlineOptions) ? saved.headlineOptions : initialExport?.headline ? [initialExport.headline] : []);
  const [selectedHeadline, setSelectedHeadline] = useState(initialExport?.headline ?? saved.headline ?? '');
  const [quotesLoading, setQuotesLoading] = useState(false);

  // Designer/bio state
  const [bioEnabled, setBioEnabled] = useState(saved.bioEnabled !== false);
  const [bioOptions, setBioOptions] = useState<string[]>([]);
  const [selectedBio, setSelectedBio] = useState(initialExport?.bioText ?? saved.bioText ?? '');
  const [bioLoading, setBioLoading] = useState(false);

  // Caption state
  const [caption, setCaption] = useState(initialExport?.caption ?? '');
  const [captionOptions, setCaptionOptions] = useState<string[]>(Array.isArray(saved.captionOptions) ? saved.captionOptions : initialExport?.caption ? [initialExport.caption] : []);
  const [captionLoading, setCaptionLoading] = useState(false);

  // Room selection
  const [selectedRoom, setSelectedRoom] = useState<string | null>(typeof saved.roomId === 'string' ? saved.roomId : null);

  const headlineRequest = useRef(0);
  const captionRequest = useRef(0);
  const [headlineError, setHeadlineError] = useState<string | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);
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
    ? images.filter((img) => img.roomId ? img.roomId === selectedRoom : img.room === selectedRoom || img.room === rooms.find((r) => r.id === selectedRoom)?.name)
    : images;

  const changeRoom = (roomId: string | null) => {
    if (roomId === selectedRoom) return;
    headlineRequest.current++;
    captionRequest.current++;
    setSelectedRoom(roomId);
    const roomName = rooms.find((room) => room.id === roomId)?.name;
    setSelectedImageUrls((roomId ? images.filter((img) => img.roomId ? img.roomId === roomId : img.room === roomId || img.room === roomName) : images).slice(0, 5).map((img) => img.url));
    setActiveSlideIndex(0);
    setQuotesLoading(false);
    setCaptionLoading(false);
    setHeadlineError(null); setCaptionError(null);
  };
  const safeSlideIndex = Math.min(activeSlideIndex, slides.length - 1);
  useEffect(() => { setActiveSlideIndex((index) => Math.min(index, slides.length - 1)); }, [slides.length]);

  const generateQuotes = useCallback(
    async (feedback?: string) => {
      const request = ++headlineRequest.current;
      setQuotesLoading(true);
      setHeadlineError(null);
      try {
        const res = await fetch('/api/instagram-export/generate-headlines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            roomId: selectedRoom,
            pitch: saved.pitch,
            beats: saved.beats,
            feedback,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.headlines?.length) throw new Error(data.error || 'Could not generate headlines. Your current text is unchanged.');
        if (request !== headlineRequest.current) return;
        if (data.headlines?.length) {
          setQuoteOptions(data.headlines);
          setSelectedHeadline((current: string) => current || data.headlines[0]);
        }
      } catch (error) {
        if (request === headlineRequest.current) setHeadlineError(error instanceof Error ? error.message : 'Could not generate headlines.');
      } finally {
        if (request === headlineRequest.current) setQuotesLoading(false);
      }
    },
    [project.id, selectedRoom, saved.pitch, saved.beats]
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
    const request = ++captionRequest.current;
    setCaptionLoading(true);
    setCaptionError(null);
    try {
      const res = await fetch('/api/instagram-export/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          roomId: selectedRoom,
          headline: selectedHeadline,
          pitch: saved.pitch,
          beats: saved.beats,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.caption) throw new Error(data.error || 'Could not generate captions. Your current text is unchanged.');
      if (request === captionRequest.current) {
        setCaptionOptions(Array.isArray(data.captions) && data.captions.length ? data.captions : [data.caption]);
        setCaption((current: string) => current || data.caption);
      }
    } catch (error) {
      if (request === captionRequest.current) setCaptionError(error instanceof Error ? error.message : 'Could not generate caption.');
    } finally {
      if (request === captionRequest.current) setCaptionLoading(false);
    }
  }, [project.id, selectedRoom, selectedHeadline, saved.pitch, saved.beats]);

  const initialGeneration = useRef(false);
  useEffect(() => {
    if (!initialExport && !initialGeneration.current) {
      initialGeneration.current = true;
      void generateQuotes();
      void generateCaption();
    }
  }, [initialExport, generateQuotes, generateCaption]);
  useEffect(() => () => { headlineRequest.current++; captionRequest.current++; }, []);

  // Tab auto-navigation: switch to relevant slide when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'headline') {
      setActiveSlideIndex(0); // Hero slide
    } else if (tab === 'designer') {
      const bioIdx = slides.findIndex((s) => s.type === 'bio');
      if (bioIdx >= 0) setActiveSlideIndex(bioIdx);
    }
  };

  const designerHandle = designer?.name?.toLowerCase().replace(/\s+/g, '') || 'designer';

  const tabs: { key: TabType; label: string }[] = [
    { key: 'caption', label: 'Caption' },
    { key: 'headline', label: 'Headline' },
    { key: 'format', label: 'Images & style' },
    { key: 'designer', label: 'Bio' },
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
              href={studioScope === 'all' ? '/designer/studio' : `/designer/studio?project=${encodeURIComponent(project.id)}`}
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
              ...saved,
              headlineOptions: quoteOptions,
              captionOptions,
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
      {!initialExport && rooms.length > 1 && (
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
            {rooms.map((room, index) => (
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
                {room.name}{rooms.filter((candidate) => candidate.name === room.name).length > 1 ? ` (${rooms.slice(0, index + 1).filter((candidate) => candidate.name === room.name).length})` : ''}
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
          <section aria-label="Proposed story" style={{ marginBottom: '24px', color: '#2C2420' }}>
            <p style={{ fontSize: 'var(--type-meta)', color: '#8B7B68' }}>{project.title}{selectedRoom ? ' · ' + (rooms.find((room) => room.id === selectedRoom)?.name || 'Selected room') : ''} · {slides.length} slides</p>
            <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: 'var(--type-h4)', margin: '8px 0' }}>{saved.pitch || selectedHeadline || 'Shape your project story'}</h1>
            {saved.rationale && <p style={{ fontSize: 'var(--type-meta)', lineHeight: 'var(--lh-body)' }}>{saved.rationale}</p>}
            {Array.isArray(saved.beats) && saved.beats.length > 0 && <ol style={{ paddingLeft: '20px', marginTop: '12px', fontSize: 'var(--type-meta)' }}>{saved.beats.map((beat: string, index: number) => <li key={index}>{beat}</li>)}</ol>}
          </section>
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
                bioEnabled={bioEnabled}
                slideCount={slideCount}
                setSlideCount={setSlideCount}
                images={filteredImages}
                selectedImageUrls={selectedImageUrls}
                setSelectedImageUrls={setSelectedImageUrls}
              />
            )}

            {activeTab === 'headline' && (
              <HeadlineTab
                error={headlineError}
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
                setBioEnabled={(enabled) => { setBioEnabled(enabled); if (enabled) setSlideCount((count) => count === 2 ? 3 : count); }}
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
                error={captionError}
                captionOptions={captionOptions}
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
