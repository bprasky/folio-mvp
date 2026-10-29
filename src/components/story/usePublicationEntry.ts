'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** The first gesture belongs to the cover; it must never also advance a room. */
export function usePublicationEntry(canvas: RefObject<HTMLDivElement>, mobile: boolean, onEntered?: () => void) {
  const [phase, setPhase] = useState<'opening' | 'revealing' | 'ready'>('opening');
  const phaseRef = useRef(phase);
  const suppressClickUntil = useRef(0);
  const begin = useCallback(() => {
    if (phaseRef.current !== 'opening') return;
    phaseRef.current = 'revealing';
    setPhase('revealing');
  }, []);

  useEffect(() => {
    if (phase !== 'revealing') return;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 650;
    const timer = window.setTimeout(() => {
      phaseRef.current = 'ready';
      setPhase('ready');
      onEntered?.();
      // The cover button disappears; place keyboard focus inside the experience.
      canvas.current?.focus({ preventScroll: true });
    }, duration);
    return () => window.clearTimeout(timer);
  }, [phase, onEntered, canvas]);

  useEffect(() => {
    const target = canvas.current;
    if (!target || !mobile) return;
    let gesture: { y: number; gated: boolean } | null = null;
    function start(event: TouchEvent) {
      gesture = event.touches.length === 1 ? { y: event.touches[0].clientY, gated: phaseRef.current !== 'ready' } : null;
    }
    function move(event: TouchEvent) {
      if (!gesture?.gated || event.touches.length !== 1) return;
      // A non-passive listener is intentional: scrolling enters the publication
      // rather than carrying the reader past it. Pinch zoom remains available.
      if (event.cancelable) event.preventDefault();
      if (Math.abs(event.touches[0].clientY - gesture.y) > 12) begin();
    }
    function end() {
      if (gesture?.gated) {
        suppressClickUntil.current = Date.now() + 800;
        begin();
      }
      gesture = null;
    }
    function cancel() { gesture = null; }
    function wheel(event: WheelEvent) {
      if (phaseRef.current === 'ready' || event.ctrlKey || Math.abs(event.deltaY) < 2) return;
      event.preventDefault();
      begin();
    }
    target.addEventListener('touchstart', start, { passive: true });
    target.addEventListener('touchmove', move, { passive: false });
    target.addEventListener('touchend', end);
    target.addEventListener('touchcancel', cancel);
    target.addEventListener('wheel', wheel, { passive: false });
    return () => {
      target.removeEventListener('touchstart', start);
      target.removeEventListener('touchmove', move);
      target.removeEventListener('touchend', end);
      target.removeEventListener('touchcancel', cancel);
      target.removeEventListener('wheel', wheel);
    };
  }, [canvas, mobile, begin]);

  return { phase, begin, suppressClickUntil };
}
