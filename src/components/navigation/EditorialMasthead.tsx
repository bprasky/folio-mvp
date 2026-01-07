"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { GlobalSearch } from "./GlobalSearch";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import { MobileMenu } from "./MobileMenu";

const SCROLL_THRESHOLD = 100; // Trigger point for state change (50-100px as specified)

export function EditorialMasthead() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();

  // Track scroll position with requestAnimationFrame for smooth performance
  useEffect(() => {
    let ticking = false;

    const updateScrollState = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > SCROLL_THRESHOLD);
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollState);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Check initial state
    updateScrollState();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Transform values for smooth animations - using CSS transforms for performance
  const mastheadScale = useTransform(
    scrollY,
    [0, SCROLL_THRESHOLD],
    [1, 0.25]
  );
  const mastheadOpacity = useTransform(
    scrollY,
    [0, SCROLL_THRESHOLD],
    [1, 0]
  );
  const mastheadY = useTransform(
    scrollY,
    [0, SCROLL_THRESHOLD],
    [0, -120]
  );
  const navLogoOpacity = useTransform(
    scrollY,
    [0, SCROLL_THRESHOLD],
    [0, 1]
  );
  const navLogoScale = useTransform(
    scrollY,
    [0, SCROLL_THRESHOLD],
    [0.8, 1]
  );

  return (
    <>
      {/* Sticky Navigation Bar */}
      <motion.header
        className="sticky top-0 z-50 w-full border-b border-neutral-200/50 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80"
        style={{
          height: "64px",
        }}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Mobile Menu + Logo (in scrolled state) */}
          <div className="flex items-center gap-4 min-w-0">
            <MobileMenu />
            
            {/* FOLIO Logo - appears in nav when scrolled, positioned left */}
            <motion.div
              className="hidden md:block"
              style={{
                opacity: navLogoOpacity,
                scale: navLogoScale,
                pointerEvents: isScrolled ? "auto" : "none",
              }}
            >
              <Link
                href="/"
                className="font-serif text-xl tracking-tight font-semibold text-neutral-900 hover:text-neutral-700 transition-colors whitespace-nowrap"
              >
                <motion.span
                  layoutId="folio-masthead"
                  className="block"
                >
                  FOLIO
                </motion.span>
              </Link>
            </motion.div>

            {/* Search Bar - always visible in nav */}
            <div className="flex-1 max-w-md mx-4 hidden md:block">
              <GlobalSearch placeholder="Search designers, products, events..." />
            </div>
          </div>

          {/* Center: Nav Links (desktop) */}
          <div className="hidden md:flex items-center gap-4">
            <NavLinks />
          </div>

          {/* Right: User Menu */}
          <div className="flex items-center gap-4">
            <div className="md:hidden">
              <GlobalSearch placeholder="Search..." />
            </div>
            <UserMenu />
          </div>
        </nav>
      </motion.header>

      {/* Large Editorial Masthead - initial state, animates into nav */}
      <div 
        className="relative w-full bg-white"
        style={{
          paddingTop: "20px",
          paddingBottom: "20px",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex flex-col items-center justify-center text-center h-full">
            {/* Large FOLIO Masthead - smoothly transforms into nav logo */}
            <motion.div
              style={{
                scale: mastheadScale,
                opacity: mastheadOpacity,
                y: mastheadY,
              }}
              className="will-change-transform"
            >
              <Link
                href="/"
                className="block font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light uppercase text-neutral-900 hover:text-neutral-700 transition-colors cursor-pointer"
                style={{
                  letterSpacing: "0.05em",
                  fontWeight: 300,
                }}
              >
                <motion.span
                  layoutId="folio-masthead"
                  className="block"
                >
                  FOLIO
                </motion.span>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}

