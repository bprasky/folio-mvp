'use client';

import { useEffect, useRef, useState } from 'react';
import { drawPublicationPhoto, PUBLICATION_FONTS, type PublicationPhoto } from '@/lib/instagram-export/publication-photo';
import type { AspectRatio } from '@/lib/instagram-export/generate-images';

let fontsReady: Promise<void> | undefined;
function loadPublicationFonts() {
  if (!fontsReady) fontsReady = Promise.all([
    new FontFace(PUBLICATION_FONTS.headline, 'url(/fonts/publication/CormorantGaramond.ttf)'),
    new FontFace(PUBLICATION_FONTS.body, 'url(/fonts/publication/InstrumentSans.ttf)'),
  ].map(async face => { document.fonts.add(await face.load()); })).then(() => undefined).catch(error => {
    fontsReady = undefined;
    throw error;
  });
  return fontsReady;
}

export function PublicationPhotoPreview({ imageUrl, photo, aspectRatio }: { imageUrl: string; photo: PublicationPhoto; aspectRatio: AspectRatio }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const width = 1080;
  const height = aspectRatio === '9:16' ? 1920 : aspectRatio === '4:5' ? 1350 : 1080;
  useEffect(() => {
    let current = true;
    setError(false); setReady(false);
    const image = new Image();
    const imageReady = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Photo could not load'));
    });
    Promise.all([loadPublicationFonts(), imageReady]).then(() => {
        if (!current || !canvas.current) return;
        const context = canvas.current.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        drawPublicationPhoto(context, image, image.naturalWidth, image.naturalHeight, photo, width, height);
        setReady(true);
    }).catch(() => { if (current) setError(true); });
    image.src = imageUrl;
    return () => { current = false; image.onload = null; image.onerror = null; };
  }, [imageUrl, photo, height]);
  const description = [photo.projectName, photo.firmName, photo.location, photo.roomName, photo.quote, photo.attribution].filter(Boolean).join(' · ');
  return <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--surface-canvas)' }}>
    <canvas ref={canvas} width={width} height={height} role="img" aria-label={description} style={{ width: '100%', height: '100%', display: 'block', opacity: ready ? 1 : 0 }} />
    {!ready && <p role={error ? 'alert' : 'status'} style={{ position: 'absolute', inset: '40% 24px auto', textAlign: 'center', fontSize: 'var(--type-meta)' }}>{error ? 'The photo preview could not load. Refresh to try again.' : 'Preparing photo preview…'}</p>}
  </div>;
}
