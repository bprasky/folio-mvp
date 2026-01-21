"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { GlobalSearch } from "./GlobalSearch";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import { MobileMenu } from "./MobileMenu";
import { CreateButton } from "./CreateButton";

const SCROLL_THRESHOLD = 100; // Trigger point for state change (50-100px as specified)
const MAGAZINE_SCROLL_THRESHOLD = 200; // Higher threshold for magazine page (waits for hero scroll)

export function EditorialMasthead() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();
  const pathname = usePathname();

  // Check if we're on the magazine page - hide large masthead and adjust header
  const isMagazinePage = pathname === "/magazine" || pathname?.startsWith("/magazine?");
  const effectiveThreshold = isMagazinePage ? MAGAZINE_SCROLL_THRESHOLD : SCROLL_THRESHOLD;

  // Track scroll position with requestAnimationFrame for smooth performance
  useEffect(() => {
    let ticking = false;

    const updateScrollState = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > effectiveThreshold);
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
  }, [effectiveThreshold]);

  // Transform values for smooth animations - using CSS transforms for performance
  const mastheadScale = useTransform(
    scrollY,
    [0, effectiveThreshold],
    [1, 0.25]
  );
  const mastheadOpacity = useTransform(
    scrollY,
    [0, effectiveThreshold],
    [1, 0]
  );
  const mastheadY = useTransform(
    scrollY,
    [0, effectiveThreshold],
    [0, -120]
  );
  const navLogoOpacity = useTransform(
    scrollY,
    [0, effectiveThreshold],
    [0, 1]
  );
  const navLogoScale = useTransform(
    scrollY,
    [0, effectiveThreshold],
    [0.8, 1]
  );
  // Header background opacity for magazine page - transparent initially
  const headerBgOpacity = useTransform(
    scrollY,
    [0, effectiveThreshold],
    isMagazinePage ? [0, 0.95] : [0.95, 0.95]
  );

  return (
    <>
      {/* Sticky Navigation Bar */}
      <motion.header
        className={`sticky top-0 z-50 w-full backdrop-blur-md transition-colors duration-300 ${
          isMagazinePage && !isScrolled
            ? 'border-b border-transparent'
            : 'border-b border-[var(--ridge-outer)]'
        }`}
        style={{
          height: "64px",
          backgroundColor: isMagazinePage
            ? `rgba(255, 255, 255, ${isScrolled ? 0.95 : 0})`
            : 'rgba(255, 255, 255, 0.95)',
        }}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Mobile Menu + Logo (in scrolled state) */}
          <div className="flex items-center gap-4 min-w-0">
            <MobileMenu />

            {/* FOLIO Logo - appears in nav when scrolled (or always on magazine page) */}
            <motion.div
              className="hidden md:block"
              style={{
                // On magazine page: always visible, else: fade in on scroll
                opacity: isMagazinePage ? 1 : navLogoOpacity,
                scale: isMagazinePage ? 1 : navLogoScale,
                pointerEvents: isMagazinePage || isScrolled ? "auto" : "none",
              }}
            >
              <Link
                href="/"
                className={`font-serif text-xl tracking-tight font-semibold transition-colors whitespace-nowrap ${
                  isMagazinePage && !isScrolled
                    ? 'text-white hover:text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
                    : 'text-[var(--text-primary)] hover:text-[var(--text-primary)]'
                }`}
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

          {/* Right: Create Button + User Menu */}
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <GlobalSearch placeholder="Search..." />
            </div>
            <CreateButton />
            <UserMenu />
          </div>
        </nav>
      </motion.header>

      {/* Large Editorial Masthead - initial state, animates into nav */}
      {/* Hidden on magazine page since the hero has its own glass foil masthead */}
      {!isMagazinePage && (
        <div
          className="relative w-full bg-[var(--bg-base)]"
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
                  className="block font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light uppercase text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
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
      )}
    </>
  );
}

