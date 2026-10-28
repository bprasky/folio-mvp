'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import Image from '@/components/FolioImage';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import type { StoryData } from '@/lib/story/buildRoomTiles';
import { buildRoomSlides, capitalizeOpening, slideLabel, type RoomPhoto } from '@/lib/story/roomSlides';
import { readPresentation, presentationTokens } from '@/lib/story/presentation';
import { useStoryEdit } from './StoryEditContext';
import { QuoteTile } from './QuoteTile';
import { PublicationControls } from './PublicationControls';
import styles from './ImmersiveRooms.module.css';

export function ImmersiveRooms({ story, projectName, presentation, autoExpandRoom, onProductClick }: {
  story: StoryData; projectName: string; presentation: unknown; autoExpandRoom?: string | null; onProductClick: (product: any) => void;
}) {
  const edit = useStoryEdit();
  const serialized = JSON.stringify(readPresentation(presentation));
  const saved = useMemo(() => readPresentation(JSON.parse(serialized)), [serialized]);
  const [preferences, setPreferences] = useState(saved);
  useEffect(() => setPreferences(saved), [saved]);
  const slides = useMemo(() => buildRoomSlides(story.roomTiles, preferences.roomOrder), [story.roomTiles, preferences.roomOrder]);
  const [selectedId, setSelectedId] = useState<string | null>(() => slides[0]?.id ?? null);
  const index = Math.max(0, slides.findIndex(slide => slide.id === selectedId));
  const slide = slides[index];
  const room = slide?.kind === 'story' ? slide.room : null;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [galleryPhoto, setGalleryPhoto] = useState<RoomPhoto | null>(null);
  const [reading, setReading] = useState(false);
  const [clean, setClean] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 1100, height: 612 });
  const [aspect, setAspect] = useState(1.5);
  const canvas = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const photoButton = useRef<HTMLButtonElement>(null);
  const galleryButtons = useRef(new Map<string, HTMLButtonElement>());
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeEnded = useRef(false);
  const [labelHeight, setLabelHeight] = useState(260);
  const readerId = useId();
  const deepLinked = useRef<string | null>(null);

  const photos = room ? [room.heroImage, ...room.additionalImages] : [];
  const image = galleryPhoto?.image ?? photos[photoIndex] ?? photos[0] ?? (slide?.kind === 'gallery' ? slide.photos[0].image : null);
  const imageRoom = galleryPhoto?.room ?? room;
  const quote = room?.pullQuote;
  const folioAuthored = !!room?.pullQuoteSelection && typeof room.pullQuoteSelection !== 'string' && room.pullQuoteSelection.authorship === 'folio';
  const identity = [projectName, story.designerStudio || story.designerName, story.location].filter(Boolean);
  const tokens = presentationTokens(preferences.accent);
  const mobile = dimensions.width <= 620;
  const availablePhotoHeight = Math.max(150, dimensions.height - labelHeight + 36);
  const photoWidth = clean ? dimensions.width : mobile ? Math.min(dimensions.width, availablePhotoHeight * aspect) : Math.min(dimensions.width * .60, dimensions.height * aspect, Math.max(280, dimensions.width - 340));
  const photoHeight = clean ? dimensions.height : mobile ? Math.min(dimensions.width / aspect, availablePhotoHeight) : dimensions.height;

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(target); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!label.current) return;
    const observer = new ResizeObserver(([entry]) => setLabelHeight(entry.contentRect.height + 40));
    observer.observe(label.current); return () => observer.disconnect();
  }, [slide?.id, reading]);
  useEffect(() => {
    if (reading) { reader.current?.focus({ preventScroll: true }); reader.current?.scrollTo(0, 0); }
  }, [reading]);
  useEffect(() => {
    if (clean) photoButton.current?.focus({ preventScroll: true });
    else if (galleryPhoto) galleryButtons.current.get(galleryPhoto.image.id)?.focus({ preventScroll: true });
  }, [clean, galleryPhoto]);
  useEffect(() => {
    if (!autoExpandRoom || deepLinked.current === autoExpandRoom) return;
    const found = slides.find(candidate => candidate.kind === 'story'
      ? candidate.room.roomSlug === autoExpandRoom || candidate.room.roomId === autoExpandRoom
      : candidate.photos.some(photo => photo.room.roomSlug === autoExpandRoom || photo.room.roomId === autoExpandRoom));
    if (found) { setSelectedId(found.id); setReading(found.kind === 'story'); deepLinked.current = autoExpandRoom; }
  }, [autoExpandRoom, slides]);

  function select(nextIndex: number) {
    if (edit?.anyFieldOpen || !slides[nextIndex]) return;
    setSelectedId(slides[nextIndex].id); setReading(false); setClean(false); setPhotoIndex(0); setGalleryPhoto(null);
  }
  function closeReader() { setReading(false); requestAnimationFrame(() => expandButton.current?.focus({ preventScroll: true })); }
  function togglePhoto() {
    if (edit?.anyFieldOpen) return;
    if (swipeEnded.current) { swipeEnded.current = false; return; }
    setClean(value => !value);
  }
  if (!slide || !image) return null;

  return <section className={styles.shell} aria-label="Explore the project rooms"
    style={{ '--room-bg': tokens.background, '--room-ink': tokens.text, '--room-glass': tokens.glass } as CSSProperties}>
    <PublicationControls rooms={story.roomTiles} value={preferences} saved={saved} onChange={setPreferences} />
    <div ref={canvas} className={[styles.canvas, reading ? styles.reading : '', clean ? styles.clean : '', slide.kind === 'gallery' ? styles.galleryMode : ''].join(' ')}
      style={{ '--photo-end': `${photoWidth}px`, '--photo-left': `${mobile && !clean ? (dimensions.width - photoWidth) / 2 : 0}px`, '--photo-height': `${photoHeight}px`, '--arrow-y': `${Math.max(100, photoHeight * .5)}px`, '--mobile-quote-size': quote && quote.length > 180 ? '20px' : '25px' } as CSSProperties}
      onKeyDown={event => {
        if ((event.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) return;
        if (event.key === 'Escape') { if (reading) closeReader(); else setClean(false); }
        if (!reading && !edit?.anyFieldOpen && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault(); select(index + (event.key === 'ArrowRight' ? 1 : -1));
        }
      }}
      onTouchStart={event => { swipeEnded.current = false; const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY }; }}
      onTouchEnd={event => {
        if (!touchStart.current || reading || clean) return;
        const touch = event.changedTouches[0]; const dx = touch.clientX - touchStart.current.x; const dy = touch.clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) { swipeEnded.current = true; select(index + (dx < 0 ? 1 : -1)); }
      }}>
      <div className={styles.ambient} aria-hidden="true"><Image src={image.url} alt="" fill sizes="(max-width:620px) 100vw, 1200px" style={{ objectFit: 'cover' }} /></div>
      <div className={styles.sideBlur} aria-hidden="true"><Image src={image.url} alt="" fill sizes="800px" style={{ objectFit: 'fill', objectPosition: 'right center' }} /></div>
      {(slide.kind === 'story' || clean) && <div className={styles.photo}>
        <Image key={image.id} src={image.url} alt={imageRoom?.roomLabel || slideLabel(slide)} fill
          sizes="(max-width:620px) 100vw, 65vw" style={{ objectFit: 'contain' }}
          onLoad={event => { const target = event.currentTarget; if (target.naturalWidth && target.naturalHeight) setAspect(target.naturalWidth / target.naturalHeight); }} />
      </div>}
      <div className={styles.wash} aria-hidden="true" />
      <button type="button" ref={photoButton} className={styles.photoToggle} onClick={togglePhoto} aria-label={clean ? 'Show room details' : 'View full photograph without text'} tabIndex={reading ? -1 : 0} />
      {!clean && <>
        <div className={styles.brand} aria-label="Folio">FOLIO</div>
        {slide.kind === 'gallery' && <>
          <p className={styles.galleryIdentity}>{identity.join(' · ')}</p>
          <div className={styles.gallery} data-count={slide.photos.length}>
            {slide.photos.map(photo => <button type="button" key={photo.image.id} aria-label={`View full photograph of ${photo.room.roomLabel}`}
              ref={element => { if (element) galleryButtons.current.set(photo.image.id, element); else galleryButtons.current.delete(photo.image.id); }}
              onClick={() => { if (swipeEnded.current) { swipeEnded.current = false; return; } setGalleryPhoto(photo); setClean(true); }}>
              <Image src={photo.image.url} alt={photo.room.roomLabel} fill sizes="(max-width:620px) 50vw, 30vw" style={{ objectFit: 'cover' }} />
              <span>{photo.room.roomLabel}</span><Expand size={18} aria-hidden="true" />
            </button>)}
          </div>
        </>}
        {room && !reading && <div className={styles.presentation} ref={label}>
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
        {room && reading && <div className={styles.readerPanel} id={readerId}>
          <div className={styles.readerHead}><p className={styles.identity}>{identity.join(' · ')}</p>
            <button type="button" onClick={closeReader} aria-label="Collapse room article"><ChevronUp size={22} /> <span>Collapse</span></button></div>
          <div className={styles.copy} ref={reader} tabIndex={0} role="region" aria-label={`${room.roomLabel} article`}>
            <h2>{room.roomLabel}</h2>
            {quote && (folioAuthored ? <p className={styles.readingQuote}>{quote}</p> : <blockquote className={styles.readingQuote}>
              “{quote}”<cite className={styles.quoteCredit}>— {room.attribution}</cite>
            </blockquote>)}
            {(room.editorialParagraphs.length ? room.editorialParagraphs : [room.editorialNarrative || '']).filter(paragraph => paragraph.trim()).map((paragraph, i) =>
              <p key={i}>{i === 0 ? capitalizeOpening(paragraph) : paragraph}</p>)}
            {!!room.products.length && <div className={styles.products}><h3>In this room</h3>{room.products.map(product =>
              <button type="button" key={product.id} onClick={() => onProductClick(product)}>{product.name} ↗</button>)}</div>}
          </div>
        </div>}
        {!reading && <div className={styles.navigation}>
          <div className={styles.roomPicker}><span aria-hidden="true">Rooms</span><select aria-label="Go to room" value={slide.id} disabled={!!edit?.anyFieldOpen}
            onChange={event => select(slides.findIndex(item => item.id === event.target.value))}>
            {slides.map(item => <option key={item.id} value={item.id}>{slideLabel(item)}</option>)}
          </select></div>
          <div className={styles.arrows}>
            <button type="button" aria-label="Previous room" disabled={index === 0 || !!edit?.anyFieldOpen} onClick={() => select(index - 1)}><ChevronLeft size={21} /></button>
            <span className={styles.position} aria-live="polite">{index + 1} / {slides.length}</span>
            <button type="button" aria-label="Next room" disabled={index === slides.length - 1 || !!edit?.anyFieldOpen} onClick={() => select(index + 1)}><ChevronRight size={21} /></button>
          </div>
        </div>}
      </>}
    </div>
    {!clean && <>
      {room && photos.length > 1 && <div className={styles.photoChoices} aria-label={`Photographs of ${room.roomLabel}`}>
        {photos.map((photo, i) => <button type="button" key={photo.id} aria-label={`${room.roomLabel}, photograph ${i + 1}`} aria-pressed={photoIndex === i} onClick={() => setPhotoIndex(i)}>
          <Image src={photo.url} alt="" width={96} height={64} style={{ objectFit: 'cover' }} />
        </button>)}
      </div>}
      <div className={styles.strip} aria-label="All rooms">
        {slides.map((item, i) => {
          const thumb = item.kind === 'story' ? item.room.heroImage : item.photos[0].image;
          return <button type="button" key={item.id} aria-pressed={index === i} disabled={!!edit?.anyFieldOpen} onClick={() => select(i)}>
            <span className={styles.thumbnail}><Image src={thumb.url} alt="" fill sizes="(max-width:900px) 25vw, 200px" style={{ objectFit: 'cover' }} /></span>
            <span>{slideLabel(item)}</span>
          </button>;
        })}
      </div>
      {slide.kind === 'gallery' && <div className={styles.galleryProducts}>
        {Array.from(new Map(slide.photos.flatMap(photo => photo.room.products).map(product => [product.id, product])).values()).map(product =>
          <button type="button" key={product.id} onClick={() => onProductClick(product)}>{product.name} ↗</button>)}
      </div>}
    </>}
    {edit && room && room.chapterIndex >= 0 && <div className={styles.editRoom} hidden={clean}>
      <p>Edit this room</p>
      <QuoteTile key={room.roomId} {...room} isExpanded onClick={() => {}} reducedMotion />
    </div>}
  </section>;
}
