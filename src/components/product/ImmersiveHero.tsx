"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import SafeImage from "@/components/common/SafeImage";
import { Product } from "@/lib/mock/product";
import { TacticalMenu } from "./TacticalMenu";

const Product3DViewer = dynamic(() => import("./Product3DViewer"), {
  ssr: false,
});

interface ImmersiveHeroProps {
  media: {
    videoUrl?: string;
    imageUrl?: string;
  };
  product: Product;
  mesh3dUrl?: string;
  meshColor?: string;
  scenePresetId?: string;
  productCategory?: string;
  title: string;
  brand?: string;
  palette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const IDLE_TIMEOUT = 2500; // ms before returning to idle after orbit ends

export function ImmersiveHero({
  media,
  product,
  mesh3dUrl,
  meshColor,
  scenePresetId,
  productCategory,
  title,
  brand,
  palette,
}: ImmersiveHeroProps) {
  const [show3D, setShow3D] = useState(!!mesh3dUrl);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Orbit state callbacks
  const handleOrbitStart = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    setIsOrbiting(true);
    setMenuOpen(false); // Close tactical menu on orbit
  }, []);

  const handleOrbitEnd = useCallback(() => {
    idleTimerRef.current = setTimeout(() => {
      setIsOrbiting(false);
    }, IDLE_TIMEOUT);
  }, []);

  // Sync immersive state to body for global nav CSS targeting
  useEffect(() => {
    document.body.dataset.immersiveState = isOrbiting ? "orbiting" : "idle";
    return () => {
      delete document.body.dataset.immersiveState;
    };
  }, [isOrbiting]);

  // Detect first scroll to hide scroll indicator
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 50) {
        setHasScrolled(true);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cleanup idle timer on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Dynamic gradient from palette
  const gradientStyle = palette
    ? {
        background: `linear-gradient(to bottom, ${palette.primary}08, ${palette.secondary}06, ${palette.accent}04)`,
      }
    : undefined;

  const hudOpacity = isOrbiting ? 0.3 : 1;

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      style={
        gradientStyle || {
          background: "linear-gradient(to bottom, #f5f0eb, #ede8e2, #e8e2db)",
        }
      }
    >
      {/* 3D/Image Toggle Badge */}
      {mesh3dUrl && (
        <button
          onClick={() => setShow3D((prev) => !prev)}
          className="glass-badge absolute top-6 right-6 z-20 cursor-pointer gap-2 px-3 py-1.5"
          style={{
            opacity: hudOpacity,
            transition: "opacity 300ms ease-out",
          }}
          aria-label={show3D ? "Switch to image view" : "Switch to 3D view"}
        >
          {show3D ? "Image" : "3D"}
        </button>
      )}

      {/* Media Layer */}
      {show3D && mesh3dUrl ? (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
          <Product3DViewer
            glbUrl={mesh3dUrl}
            fallbackImageUrl={media.imageUrl}
            productName={title}
            color={meshColor}
            scenePresetId={scenePresetId}
            productCategory={productCategory}
            onOrbitStart={handleOrbitStart}
            onOrbitEnd={handleOrbitEnd}
            onDoubleClick={() => setMenuOpen((prev) => !prev)}
            className="w-full h-full"
          />
        </div>
      ) : (
        <div className="absolute inset-0 w-full h-full">
          {media.imageUrl ? (
            <div className="relative w-full h-full">
              <SafeImage
                src={media.imageUrl}
                alt={title}
                fill
                priority
                className="object-cover"
                style={{ objectPosition: "center 45%" }}
                sizes="(min-width: 1024px) 1200px, 100vw"
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-stone-200 to-stone-300" />
          )}
        </div>
      )}

      {/* HUD: Product Identity — Top Left, below nav */}
      <div
        className="absolute top-20 left-6 lg:top-24 lg:left-12 z-10 pointer-events-none max-w-md"
        style={{
          opacity: hudOpacity,
          transition: "opacity 300ms ease-out",
        }}
      >
        {brand && (
          <div
            className="font-body uppercase font-normal mb-1.5"
            style={{
              fontSize: "clamp(11px, 1.2vw, 14px)",
              letterSpacing: "0.14em",
              color: "rgba(120, 113, 108, 0.8)",
            }}
          >
            {brand}
          </div>
        )}
        <h1
          className="font-headline italic font-normal tracking-tight"
          style={{
            fontSize: "clamp(24px, 3.5vw, 42px)",
            lineHeight: 1.1,
            color: "rgba(28, 25, 23, 0.85)",
          }}
        >
          {title}
        </h1>
      </div>

      {/* Tactical Menu — Right of model, vertically centered */}
      <div className="absolute top-1/2 right-6 lg:right-12 -translate-y-1/2 z-20">
        <TacticalMenu
          product={product}
          isOpen={menuOpen}
          onToggle={() => setMenuOpen((prev) => !prev)}
          onClose={() => setMenuOpen(false)}
          hudOpacity={hudOpacity}
        />
      </div>

      {/* Scroll Indicator — Bottom Center, Desktop Only */}
      <AnimatePresence>
        {!hasScrolled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 1.5, duration: 0.8 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 hidden lg:flex flex-col items-center gap-2 pointer-events-none"
            style={{
              opacity: isOrbiting ? 0 : undefined,
              transition: "opacity 300ms ease-out",
            }}
          >
            <span
              className="font-body uppercase text-stone-400"
              style={{ fontSize: "11px", letterSpacing: "0.15em" }}
            >
              Scroll to explore
            </span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-px h-6 bg-stone-300"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
