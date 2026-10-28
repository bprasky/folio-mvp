"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
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
import { useNavigationWorkspace } from "./useNavigationWorkspace";

const SCROLL_THRESHOLD = 40;

export function EditorialMasthead({ signedOutHref }: { signedOutHref?: string }) {
  const pathname = usePathname();
  const workspace = useNavigationWorkspace();
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
        <nav aria-label="Primary" className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            <MobileMenu workspace={workspace} />
            <NavLinks />
            <div className="hidden md:flex items-center gap-3">
              <CreateButton workspace={workspace} />
            </div>
            <NotificationBell />
            <div className="hidden md:flex items-center gap-3">
              <InboxButton />
              <BadgeButton />
            </div>
          </div>

          <Link
            href="/"
            aria-label="Folio home"
            data-folio-brand-target
            className="justify-self-center font-serif text-xl tracking-tight font-semibold text-folio-text-primary whitespace-nowrap"
          >
            FOLIO
          </Link>

          <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-3">
            <div className="hidden min-w-0 w-full max-w-64 md:block">
              <GlobalSearch placeholder="Search Folio" />
            </div>
            <Link href="/search" aria-label="Search Folio" className="md:hidden inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-full hover:bg-surface-ground"><Search className="h-4 w-4" /></Link>
            <UserMenu workspaceData={workspace} signedOutHref={signedOutHref} />
          </div>
        </nav>
      </header>

    </>
  );
}
