'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import Image from '@/components/FolioImage';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import type { StoryData } from '@/lib/story/buildRoomTiles';
import { buildRoomSlides, capitalizeOpening, slideLabel, type RoomPhoto } from '@/lib/story/roomSlides';
import { readPresentation } from '@/lib/story/presentation';
import { useStoryEdit } from './StoryEditContext';
import { QuoteTile } from './QuoteTile';
import { PublicationControls } from './PublicationControls';
import { LeadHeadline, LeadPreview } from './StoryLead';
import { PublicationIntroduction } from './PublicationIntroduction';
import { usePublicationEntry } from './usePublicationEntry';
import styles from './ImmersiveRooms.module.css';

export function ImmersiveRooms({ story, projectName, presentation, autoExpandRoom, autoPhotoId, onProductClick, onEntered }: {
  story: StoryData; projectName: string; presentation: unknown; autoExpandRoom?: string | null; autoPhotoId?: string | null; onProductClick: (product: any) => void; onEntered?: () => void;
}) {
  const edit = useStoryEdit();
  const serialized = JSON.stringify(readPresentation(presentation));
  const saved = useMemo(() => readPresentation(JSON.parse(serialized)), [serialized]);
  const [preferences, setPreferences] = useState(saved);
  useEffect(() => setPreferences(saved), [saved]);
  const slides = useMemo(() => buildRoomSlides(story.roomTiles, preferences.roomOrder), [story.roomTiles, preferences.roomOrder]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const index = slides.findIndex(slide => slide.id === selectedId);
  const cover = index < 0;
  const slide = slides[index];
  const room = slide?.kind === 'story' ? slide.room : null;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [galleryPhoto, setGalleryPhoto] = useState<RoomPhoto | null>(null);
  const [reading, setReading] = useState(false);
  const [clean, setClean] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 1100, height: 620 });
  const [aspect, setAspect] = useState(1.5);
  const canvas = useRef<HTMLDivElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const photoButton = useRef<HTMLButtonElement>(null);
  const galleryButtons = useRef(new Map<string, HTMLButtonElement>());
  const touchStart = useRef<{ x: number; y: number; gated: boolean } | null>(null);
  const swipeEnded = useRef(false);
  const readerId = useId();
  const deepLinked = useRef<string | null>(null);

  const photos = room ? [room.heroImage, ...room.additionalImages] : [];
  const image = cover ? story.heroImage ?? { id: 'cover', url: story.heroImageUrl } : galleryPhoto?.image ?? photos[photoIndex] ?? photos[0] ?? (slide?.kind === 'gallery' ? slide.photos[0].image : null);
  const imageRoom = galleryPhoto?.room ?? room;
  const quote = room?.pullQuote;
  const folioAuthored = !!room?.pullQuoteSelection && typeof room.pullQuoteSelection !== 'string' && room.pullQuoteSelection.authorship === 'folio';
  const identity = [projectName, story.designerStudio || story.designerName, story.location].filter(Boolean);
  // Keep the photograph and label stacked until the reader has enough room
  // for the desktop text column, including wide phones and portrait tablets.
  // Match the container breakpoint in ImmersiveRooms.module.css.
  const mobile = dimensions.width <= 800;
  const { phase, begin, suppressClickUntil } = usePublicationEntry(canvas, mobile, onEntered);
  const ready = phase === 'ready';

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(target); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (reading) { reader.current?.focus({ preventScroll: true }); reader.current?.scrollTo(0, 0); }
  }, [reading]);
  useEffect(() => {
    if (clean) photoButton.current?.focus({ preventScroll: true });
    else if (galleryPhoto) galleryButtons.current.get(galleryPhoto.image.id)?.focus({ preventScroll: true });
  }, [clean, galleryPhoto]);
  useEffect(() => {
    const key = JSON.stringify([autoExpandRoom, autoPhotoId]);
    if ((!autoExpandRoom && !autoPhotoId) || deepLinked.current === key) return;
    // Photo identity wins when a room has several images or shares a gallery slide.
    const byPhoto = autoPhotoId ? slides.find(candidate => candidate.kind === 'story'
      ? [candidate.room.heroImage, ...candidate.room.additionalImages].some(photo => photo.id === autoPhotoId)
      : candidate.photos.some(photo => photo.image.id === autoPhotoId)) : undefined;
    const found = byPhoto || (autoExpandRoom ? slides.find(candidate => candidate.kind === 'story'
      ? candidate.room.roomSlug === autoExpandRoom || candidate.room.roomId === autoExpandRoom
      : candidate.photos.some(photo => photo.room.roomSlug === autoExpandRoom || photo.room.roomId === autoExpandRoom)) : undefined);
    if (!found) return;
    // A valid direct link is already an invitation to enter this room.
    if (!ready) { begin(); return; }
    setSelectedId(found.id);
    setPhotoIndex(found.kind === 'story' ? Math.max(0, [found.room.heroImage, ...found.room.additionalImages].findIndex(photo => photo.id === autoPhotoId)) : 0);
    setGalleryPhoto(found.kind === 'gallery' && byPhoto ? found.photos.find(photo => photo.image.id === autoPhotoId) ?? null : null);
    setClean(found.kind === 'gallery' && !!byPhoto);
    setReading(found.kind === 'story');
    deepLinked.current = key;
  }, [ready, autoExpandRoom, autoPhotoId, slides, begin]);

  function select(nextIndex: number) {
    if (!ready || edit?.anyFieldOpen || nextIndex < -1 || nextIndex >= slides.length) return;
    setSelectedId(slides[nextIndex]?.id ?? null); setReading(false); setClean(false); setPhotoIndex(0); setGalleryPhoto(null);
    if (mobile && canvas.current && canvas.current.getBoundingClientRect().top < 0) {
      canvas.current.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  function closeReader() { if (!ready || edit?.anyFieldOpen) return; setReading(false); requestAnimationFrame(() => expandButton.current?.focus({ preventScroll: true })); }
  function togglePhoto() {
    if (!ready || edit?.anyFieldOpen) return;
    if (swipeEnded.current) { swipeEnded.current = false; return; }
    setClean(value => !value);
  }
  if (!image) return null;

  return <section className={styles.shell} aria-label={`${projectName} publication`}
    style={{ '--room-bg': preferences.accent ? `color-mix(in srgb, ${preferences.accent} 5%, var(--surface-publication))` : 'var(--surface-publication)', '--room-ink': 'var(--publication-ink)', '--photo-aspect': aspect } as CSSProperties}>
    <PublicationControls rooms={story.roomTiles} value={preferences} saved={saved} onChange={setPreferences} />
    <div ref={canvas} tabIndex={-1} data-publication-phase={phase} data-publication-photo={image.id} data-publication-reading={reading} className={[styles.canvas, clean ? styles.clean : '', slide?.kind === 'gallery' ? styles.galleryMode : '', cover ? styles.cover : ''].join(' ')}
      onClickCapture={event => { if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); } }}
      onKeyDown={event => {
        if (!ready) return;
        if ((event.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) return;
        if (event.key === 'Escape') { if (clean) setClean(false); else if (reading) closeReader(); }
        if (!reading && !edit?.anyFieldOpen && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault(); select(index + (event.key === 'ArrowRight' ? 1 : -1));
        }
      }}
      onTouchStart={event => { swipeEnded.current = false; const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY, gated: !ready }; }}
      onTouchCancel={() => { touchStart.current = null; }}
      onTouchEnd={event => {
        if (!ready || !touchStart.current || touchStart.current.gated || reading || clean) return;
        const touch = event.changedTouches[0]; const dx = touch.clientX - touchStart.current.x; const dy = touch.clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) { swipeEnded.current = true; select(index + (dx < 0 ? 1 : -1)); }
      }}>
      {(cover || slide?.kind === 'story' || clean) && <div className={styles.photo} data-publication-image aria-hidden={!ready}>
        <Image key={image.id} src={image.url} alt={imageRoom?.roomLabel || projectName} fill
          sizes="100vw" priority={cover} style={{ objectFit: 'contain' }}
          onLoad={event => { const target = event.currentTarget; if (target.naturalWidth && target.naturalHeight) setAspect(target.naturalWidth / target.naturalHeight); }} />
      </div>}
      <div className={styles.wash} aria-hidden="true" />
      {(cover || slide?.kind === 'story' || clean) && <button type="button" ref={photoButton} className={styles.photoToggle} onClick={togglePhoto} aria-label={clean ? 'Show room details' : 'View full photograph without text'} disabled={!ready} tabIndex={!ready ? -1 : 0} />}
      {!clean && <div className={styles.details} aria-hidden={!ready} ref={element => { if (element) element.inert = !ready; }}>
        {slide?.kind === 'gallery' && <>
          <p className={styles.galleryIdentity}>{identity.join(' · ')}</p>
          <div className={styles.gallery} data-count={slide.photos.length}>
            {slide.photos.map(photo => <button type="button" key={photo.image.id} aria-label={`View full photograph of ${photo.room.roomLabel}`}
              ref={element => { if (element) galleryButtons.current.set(photo.image.id, element); else galleryButtons.current.delete(photo.image.id); }}
              onClick={() => { if (swipeEnded.current) { swipeEnded.current = false; return; } setGalleryPhoto(photo); setClean(true); }}>
              <Image src={photo.image.url} alt={photo.room.roomLabel} fill sizes="(max-width:848px) 100vw, 30vw" style={{ objectFit: 'cover' }} />
              <span>{photo.room.roomLabel}</span><Expand size={18} aria-hidden="true" />
            </button>)}
          </div>
        </>}
        {cover && !reading && <div className={`${styles.presentation} ${styles.introduction}`}>
          <p className={styles.identity}>{identity.map((part, i) => <span key={i}>{part}</span>)}</p>
          <LeadHeadline story={story} as="h2" readOnly />
          <button type="button" ref={expandButton} className={styles.expand} aria-label="Read project introduction" aria-expanded={false} aria-controls={readerId}
            disabled={!ready} onClick={() => setReading(true)}>
            <ChevronDown className={styles.expandArrow} size={24} aria-hidden="true" />
            <LeadPreview story={story} className={styles.preview} />
          </button>
        </div>}
        {room && !reading && <div className={styles.presentation}>
          <p className={styles.identity}>{identity.map((part, i) => <span key={i}>{part}</span>)}</p>
          <h2 title={room.roomLabel}>{room.roomLabel}<ChevronDown className={styles.mobileExpandArrow} size={22} aria-hidden="true" /></h2>
          {quote && <>
            {folioAuthored ? <p className={styles.quote}>{quote}</p> : <blockquote className={styles.quote}>“{quote}”</blockquote>}
            <p className={styles.attribution}>{folioAuthored ? 'Written by Folio' : `— ${room.attribution}`}</p>
          </>}
          <button type="button" ref={expandButton} className={styles.expand} aria-label={`Read ${room.roomLabel}`} aria-expanded={false} aria-controls={readerId}
            onClick={() => { if (swipeEnded.current) { swipeEnded.current = false; return; } setReading(true); }}>
            <ChevronDown className={styles.expandArrow} size={24} aria-hidden="true" />
            <span className={styles.preview}>{capitalizeOpening(room.editorialNarrative || '')}</span>
          </button>
        </div>}
        {(cover || room) && reading && <div className={styles.readerPanel} data-publication-text id={readerId}>
          <div className={styles.readerHead}><p className={styles.identity}>{identity.join(' · ')}</p>
            <button type="button" onClick={closeReader} disabled={!!edit?.anyFieldOpen} aria-label={cover ? "Collapse project introduction" : "Collapse room article"}><ChevronUp size={22} /> <span>Collapse</span></button></div>
          <div className={styles.copy} ref={reader} tabIndex={0} role="region" aria-label={cover ? "Project introduction" : `${room?.roomLabel} article`}>
            {cover ? <PublicationIntroduction story={story} /> : room && <>
            <h2>{room.roomLabel}</h2>
            {quote && (folioAuthored ? <div><p className={styles.readingQuote}>{quote}</p><p className={styles.attribution}>Written by Folio</p></div> : <blockquote className={styles.readingQuote}>
              “{quote}”<cite className={styles.quoteCredit}>— {room.attribution}</cite>
            </blockquote>)}
            {(room.editorialParagraphs.length ? room.editorialParagraphs : [room.editorialNarrative || '']).filter(paragraph => paragraph.trim()).map((paragraph, i) =>
              <p key={i}>{i === 0 ? capitalizeOpening(paragraph) : paragraph}</p>)}
            {!!room.products.length && <div className={styles.products}><h3>In this room</h3>{room.products.map(product =>
              <button type="button" key={product.id} onClick={() => onProductClick(product)}>{product.name} ↗</button>)}</div>}
            </>}
          </div>
        </div>}
        {ready && <div className={styles.navigation}>
          <div className={styles.roomPicker}><span aria-hidden="true">Rooms</span><select aria-label="Go to room" value={slide?.id ?? ''} disabled={!!edit?.anyFieldOpen}
            onChange={event => select(slides.findIndex(item => item.id === event.target.value))}>
            <option value="">Introduction</option>
            {slides.map(item => <option key={item.id} value={item.id}>{slideLabel(item)}</option>)}
          </select></div>
          <div className={styles.arrows}>
            <button type="button" aria-label="Previous room" disabled={cover || !!edit?.anyFieldOpen} onClick={() => select(index - 1)}><ChevronLeft size={21} /></button>
            <span className={styles.position} aria-live="polite">{cover ? 'Introduction' : `${index + 1} / ${slides.length}`}</span>
            <button type="button" aria-label="Next room" disabled={index === slides.length - 1 || !!edit?.anyFieldOpen} onClick={() => select(index + 1)}><ChevronRight size={21} /></button>
          </div>
        </div>}
      </div>}
      {ready && !clean && <div className={styles.strip} aria-label="All rooms">
        <button type="button" aria-pressed={cover} disabled={!!edit?.anyFieldOpen} onClick={() => select(-1)}>
          <span className={styles.thumbnail}><Image src={story.heroImageUrl} alt="" fill sizes="200px" style={{ objectFit: 'cover' }} /></span>
          <span>Introduction</span>
        </button>
        {slides.map((item, i) => {
          const thumb = item.kind === 'story' ? item.room.heroImage : item.photos[0].image;
          return <button type="button" key={item.id} aria-pressed={index === i} disabled={!!edit?.anyFieldOpen} onClick={() => select(i)}>
            <span className={styles.thumbnail}><Image src={thumb.url} alt="" fill sizes="(max-width:900px) 25vw, 200px" style={{ objectFit: 'cover' }} /></span>
            <span>{slideLabel(item)}</span>
          </button>;
        })}
      </div>}
      {!ready && <div className={styles.opening} aria-hidden={phase !== 'opening'}>
        <Image src={story.heroImageUrl} alt={projectName} fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
        <div className={styles.openingShade} />
        <h1>{projectName}</h1>
        <button type="button" className={styles.begin} onClick={begin} disabled={phase !== 'opening'} aria-label={`Begin ${projectName}`}>
          <span className={styles.desktopHint}>Click to begin</span><span className={styles.mobileHint}>Tap or scroll to begin</span>
        </button>
      </div>}
    </div>
    {ready && !clean && <>
      {room && photos.length > 1 && <div className={styles.photoChoices} aria-label={`Photographs of ${room.roomLabel}`}>
        {photos.map((photo, i) => <button type="button" key={photo.id} aria-label={`${room.roomLabel}, photograph ${i + 1}`} aria-pressed={photoIndex === i} onClick={() => setPhotoIndex(i)}>
          <Image src={photo.url} alt="" width={96} height={64} style={{ objectFit: 'cover' }} />
        </button>)}
      </div>}
      {slide?.kind === 'gallery' && <div className={styles.galleryProducts}>
        {Array.from(new Map(slide.photos.flatMap(photo => photo.room.products).map(product => [product.id, product])).values()).map(product =>
          <button type="button" key={product.id} onClick={() => onProductClick(product)}>{product.name} ↗</button>)}
      </div>}
    </>}
    {ready && edit && room && room.chapterIndex >= 0 && <div className={styles.editRoom} hidden={clean}>
      <p>Edit this room</p>
      <QuoteTile key={room.roomId} {...room} isExpanded onClick={() => {}} reducedMotion />
    </div>}
  </section>;
}
