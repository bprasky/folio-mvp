"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { UpdatesCarouselItem } from "@/lib/feed/getUpdatesCarousel";
import { getMonographUrl } from "@/lib/utils/getMonographUrl";

type Props = { groups: UpdatesCarouselItem[]; index: number; onClose: () => void };

export function StoryViewer({ groups, index: startIndex, onClose }: Props) {
  const [gidx, setGidx] = useState(startIndex);
  const [iidx, setIidx] = useState(0);
  const g = groups[gidx];
  const items = g?.items || [];
  const current = items[iidx];
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Auto-advance
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onEnded = () => {
      if (iidx < items.length - 1) {
        setIidx(iidx + 1);
      } else if (gidx < groups.length - 1) {
        setGidx(gidx + 1);
        setIidx(0);
      } else {
        onClose();
      }
    };

    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, [iidx, gidx, items.length, groups.length, onClose]);

  // Reset item index when group changes
  useEffect(() => {
    setIidx(0);
  }, [gidx]);

  // Play video when current item changes
  useEffect(() => {
    const v = videoRef.current;
    if (v && current) {
      v.load();
      v.play().catch(() => {
        // Auto-play may fail, that's okay
      });
    }
  }, [current]);

  if (!g) return null;

  const designerName = g.designer.studioName || g.designer.name || "Designer";
  const projectTitle = g.project.title || "Project";

  // media pick
  const media = Array.isArray(current?.media) ? current.media[0] : current?.media;
  const src = media?.url || null;
  const isVertical = (media?.orientation || "").toLowerCase() === "vertical";

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
        <div className="relative h-full w-full max-w-[900px]" onClick={(e) => e.stopPropagation()}>
          {/* HEADER: Designer — Project */}
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-3">
            <div className="rounded-full bg-white/85 px-3 py-1 text-[var(--type-meta)] text-folio-text-primary shadow">
              {g.designer.name ? (
                <Link href={getMonographUrl({ name: g.designer.name })} className="hover:underline">
                  {designerName}
                </Link>
              ) : (
                <span>{designerName}</span>
              )}
              <span className="mx-1 text-folio-text-tertiary">—</span>
              {g.project.slug ? (
                <Link href={`/p/${g.project.slug}`} className="hover:underline">
                  {projectTitle}
                </Link>
              ) : (
                <Link href={`/project/${g.project.id}`} className="hover:underline">
                  {projectTitle}
                </Link>
              )}
            </div>
            <button onClick={onClose} className="rounded-full bg-white/80 px-3 py-1 text-[var(--type-meta)]">Close</button>
          </div>

          {/* PROGRESS BARS */}
          <div className="absolute left-0 right-0 top-9 z-10 flex gap-1 px-3">
            {items.map((_, k) => (
              <div key={k} className="h-1 w-full rounded bg-white/30 overflow-hidden">
                <div 
                  className={`h-full ${
                    k < iidx ? "w-full" : k === iidx ? "animate-[story_5s_linear_forwards]" : "w-0"
                  } bg-white`} 
                />
              </div>
            ))}
          </div>

          {/* VIDEO */}
          <div className="absolute inset-0 flex items-center justify-center">
            {src ? (
              <video
                ref={videoRef}
                src={src}
                autoPlay
                playsInline
                muted
                controls={false}
                className={`max-h-[88vh] ${isVertical ? "h-[88vh] w-auto" : "w-full"} object-contain rounded-2xl shadow-2xl`}
              />
            ) : (
              <div className="h-[70vh] w-[60vw] rounded-2xl bg-surface-ground" />
            )}
          </div>

          {/* TAP/CLICK ZONES */}
          <button 
            className="absolute left-0 top-0 bottom-0 w-1/3" 
            onClick={() => {
              if (iidx > 0) {
                setIidx(iidx - 1);
              } else if (gidx > 0) {
                setGidx(gidx - 1);
                setIidx(groups[gidx - 1].items.length - 1);
              }
            }} 
            aria-label="Prev" 
          />
          <button 
            className="absolute right-0 top-0 bottom-0 w-1/3" 
            onClick={() => {
              if (iidx < items.length - 1) {
                setIidx(iidx + 1);
              } else if (gidx < groups.length - 1) {
                setGidx(gidx + 1);
                setIidx(0);
              } else {
                onClose();
              }
            }} 
            aria-label="Next" 
          />
        </div>
      </div>
      <style jsx global>{`
        @keyframes story { 
          from { width: 0% } 
          to { width: 100% } 
        }
      `}</style>
    </>
  );
}


