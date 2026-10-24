"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "./GlobalSearch";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import { MobileMenu } from "./MobileMenu";
import { CreateButton } from "./CreateButton";
import { BadgeButton } from "./BadgeButton";
import { InboxButton } from "./InboxButton";
import { NotificationBell } from "./NotificationBell";

const SCROLL_THRESHOLD = 40;

export function EditorialMasthead() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const isHomePage = pathname === "/";

  useEffect(() => {
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
  }, [pathname]);

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
          // Homepage: a solid canvas-background bar anchored above the hero
          // (not a glass bar floating over the photo). Other routes keep the
          // transparent-at-rest → glass-on-scroll treatment.
          ...(isHomePage
            ? {
                backgroundColor: "var(--surface-canvas)",
                borderBottomColor: "var(--folio-border-subtle)",
              }
            : isScrolled
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
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <MobileMenu />

            {/* Stable destination for the loading masthead on every route. */}
            <Link
              href="/"
              data-folio-brand-target
              className="font-serif text-xl tracking-tight font-semibold text-folio-text-primary hover:text-folio-text-primary whitespace-nowrap"
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
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Narrow screens keep search in MobileMenu so account actions fit. */}
            <div className="hidden sm:block md:hidden">
              <GlobalSearch placeholder="Search..." />
            </div>
            <NotificationBell />
            <InboxButton />
            <BadgeButton />
            <CreateButton />
            <UserMenu />
          </div>
        </nav>
      </header>

    </>
  );
}
