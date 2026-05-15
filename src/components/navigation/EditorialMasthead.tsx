"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "./GlobalSearch";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import { MobileMenu } from "./MobileMenu";
import { CreateButton } from "./CreateButton";
import { BadgeButton } from "./BadgeButton";
import { InboxButton } from "./InboxButton";

// Fallback scroll threshold for routes that don't render the big wordmark
// (designer/product/magazine). The wordmark-bearing routes use an
// IntersectionObserver against the wordmark element instead.
const SCROLL_THRESHOLD = 40;

export function EditorialMasthead() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const wordmarkRef = useRef<HTMLDivElement | null>(null);

  // Pages with their own immersive treatment / dashboards. These suppress the
  // big FOLIO wordmark; the corner mark stays visible at all times.
  const isDesignerPage = pathname === "/designer" || pathname?.startsWith("/designer/");
  const isProductPage = pathname?.startsWith("/products/");
  const isMagazinePage = pathname === "/magazine" || pathname?.startsWith("/magazine/");
  // /p/[slug] (StoryRenderer article route) renders its own editorial hero;
  // the corner mark in the topbar is the only Folio mark on that page.
  const isArticlePage = pathname?.startsWith("/p/");
  const hidesMasthead = isDesignerPage || isProductPage || isMagazinePage || isArticlePage;
  // Homepage embosses FOLIO into the hero image instead of rendering the
  // standalone wordmark — the corner-mark observer watches the in-hero element.
  const isHomePage = pathname === "/";

  useEffect(() => {
    if (isHomePage) {
      const sentinel = document.querySelector<HTMLElement>(
        "[data-folio-wordmark-sentinel]",
      );
      if (sentinel) {
        const observer = new IntersectionObserver(
          ([entry]) => setIsScrolled(!entry.isIntersecting),
          { rootMargin: "-40px 0px 0px 0px", threshold: 0 },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
      }
      // fall through to scroll threshold if the hero hasn't mounted yet
    } else if (!hidesMasthead && wordmarkRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => setIsScrolled(!entry.isIntersecting),
        { rootMargin: "-40px 0px 0px 0px", threshold: 0 },
      );
      observer.observe(wordmarkRef.current);
      return () => observer.disconnect();
    }

    // No wordmark to anchor against — fall back to a plain scroll threshold so
    // the header still picks up the surface tint past the fold.
    let ticking = false;
    const update = () => {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hidesMasthead, isHomePage, pathname]);

  // Corner FOLIO mark is hidden whenever the big wordmark is visible at the
  // top of the page (i.e. wordmark-bearing route + not yet scrolled past it).
  const showCornerMark = isScrolled || hidesMasthead;

  return (
    <>
      <header
        data-scrolled={isScrolled ? "true" : "false"}
        className="editorial-masthead-header sticky top-0 z-50 w-full"
        style={{
          height: "64px",
          // Reserve a transparent 1px bottom border at rest so the scrolled
          // state doesn't introduce a layout shift when the hairline appears.
          borderBottom: "1px solid transparent",
          transition:
            "background-color 200ms ease, border-color 200ms ease, backdrop-filter 200ms ease, -webkit-backdrop-filter 200ms ease",
          ...(isScrolled
            ? {
                backgroundColor:
                  "color-mix(in oklab, var(--surface) 70%, transparent)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                borderBottomColor:
                  "color-mix(in oklab, currentColor 6%, transparent)",
              }
            : {}),
        }}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 min-w-0">
            <MobileMenu />

            {/* Corner FOLIO mark — hidden while the big wordmark is in view.
                Mobile on article pages: suppressed entirely. The hamburger
                establishes brand context and the topbar was crowding the
                search + buttons row. Desktop unchanged. */}
            <Link
              href="/"
              aria-hidden={!showCornerMark}
              tabIndex={showCornerMark ? 0 : -1}
              className={`font-serif text-xl tracking-tight font-semibold text-folio-text-primary hover:text-folio-text-primary whitespace-nowrap ${
                isArticlePage ? "hidden md:inline-block" : ""
              }`}
              style={{
                opacity: showCornerMark ? 1 : 0,
                pointerEvents: showCornerMark ? "auto" : "none",
                transition: "opacity 200ms ease",
              }}
            >
              FOLIO
            </Link>

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
            <InboxButton />
            <BadgeButton />
            <CreateButton />
            <UserMenu />
          </div>
        </nav>
      </header>

      {/* Large FOLIO wordmark — sits below the sticky nav as page content.
          The homepage embosses FOLIO into the hero image instead (see
          HomepageHeroXL), so this block is suppressed there. Suppressed on
          dashboard / product / magazine / article routes as well. */}
      {!hidesMasthead && !isHomePage && (
        <div
          ref={wordmarkRef}
          className="relative w-full"
          style={{ paddingTop: "8px", paddingBottom: "0" }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-full">
            <div className="flex flex-col items-center justify-center text-center h-full">
              <h1
                className="block font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light uppercase text-folio-text-primary"
                style={{ letterSpacing: "var(--ls-wide)", fontWeight: 300, lineHeight: 1 }}
              >
                <span className="sr-only">Folio</span>
                <span aria-hidden="true">FOLIO</span>
              </h1>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
