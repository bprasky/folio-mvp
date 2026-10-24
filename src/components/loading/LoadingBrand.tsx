'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';

// The provider outlives Suspense fallbacks. Only this decorative copy animates;
// the accessible home link and newly ready content never wait for it.
type Register = (element: HTMLElement) => () => void;
const LoadingContext = createContext<Register>(() => () => {});
const REVEAL_DELAY = 160;

export function LoadingBrandProvider({ children }: { children: ReactNode }) {
  const mark = useRef<HTMLSpanElement>(null);
  const sources = useRef(new Set<HTMLElement>());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const frame = useRef<number>();
  const animation = useRef<Animation>();
  const visible = useRef(false);

  const hide = useCallback(() => {
    animation.current?.cancel();
    animation.current = undefined;
    visible.current = false;
    if (mark.current) mark.current.style.opacity = '0';
  }, []);

  const position = useCallback(() => {
    const node = mark.current;
    const source = Array.from(sources.current).find(element => element.isConnected);
    const target = document.querySelector<HTMLElement>('[data-folio-brand-target]');
    if (!node || !source || !target) return false;
    const bounds = source.getBoundingClientRect();
    const header = target.closest('header')?.getBoundingClientRect();
    const size = node.getBoundingClientRect();
    node.style.left = `${bounds.left + (bounds.width - size.width) / 2}px`;
    node.style.top = `${Math.max(header?.bottom ?? 64, bounds.top) + 24}px`;
    return true;
  }, []);

  const register = useCallback<Register>((element) => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    sources.current.add(element);
    if (animation.current || (visible.current && !position())) hide();
    if (!visible.current) {
      hide();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (sources.current.size && position() && mark.current) {
          visible.current = true;
          mark.current.style.opacity = '0.12';
        }
      }, REVEAL_DELAY);
    }

    return () => {
      sources.current.delete(element);
      if (sources.current.size) return;
      clearTimeout(timer.current);
      // Coalesce nested fallback handoffs and StrictMode's effect replay.
      frame.current = requestAnimationFrame(() => {
        if (sources.current.size) return;
        const node = mark.current;
        const target = document.querySelector<HTMLElement>('[data-folio-brand-target]');
        if (!visible.current || !node || !target ||
          matchMedia('(prefers-reduced-motion: reduce)').matches || !node.animate) {
          hide();
          return;
        }
        const from = node.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        if (!from.width || !to.width) { hide(); return; }
        // No layout animation: content has already replaced the fallback.
        animation.current = node.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 0.12 },
          { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: 0 },
        ], { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
        animation.current.onfinish = hide;
      });
    };
  }, [hide, position]);

  useEffect(() => {
    const reposition = () => {
      if (sources.current.size && visible.current) position();
      else if (visible.current) hide(); // Never fly toward an outdated viewport target.
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, { passive: true });
    return () => {
      clearTimeout(timer.current);
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      hide();
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition);
    };
  }, [hide, position]);

  return (
    <LoadingContext.Provider value={register}>
      {children}
      <span ref={mark} aria-hidden="true" className="folio-loading-mark">FOLIO</span>
    </LoadingContext.Provider>
  );
}

export function LoadingSurface({ children, label = 'Loading page' }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const register = useContext(LoadingContext);
  const pathname = usePathname();
  useEffect(() => ref.current ? register(ref.current) : undefined, [register, pathname]);
  return (
    <div ref={ref} className="relative min-w-0" data-folio-loading>
      <span role="status" className="sr-only">{label}</span>
      <div aria-hidden="true" className="folio-loading-skeleton">{children}</div>
    </div>
  );
}
