"use client";

import { useRef, useEffect } from "react";
import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "./GlobalSearch";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { MobileMenu } from "./MobileMenu";
import { CreateButton } from "./CreateButton";
import { useNavigationWorkspace } from "./useNavigationWorkspace";
import styles from "./navigation.module.css";

const COMPACT_SCROLL_DISTANCE = 96;

export function EditorialMasthead({ signedOutHref }: { signedOutHref?: string }) {
  const pathname = usePathname();
  const workspace = useNavigationWorkspace();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame: number | null = null;
    const update = () => {
      const progress = Math.min(Math.max(window.scrollY, 0) / COMPACT_SCROLL_DISTANCE, 1);
      headerRef.current?.style.setProperty("--masthead-scroll", String(progress));
      headerRef.current?.setAttribute("data-scrolled", String(progress > 0));
      frame = null;
    };
    const onScroll = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return (
    <header ref={headerRef} data-scrolled="false" className={`editorial-masthead-header ${styles.header}`}>
      <div className={styles.surface}>
        <nav aria-label="Primary" className={styles.nav}>
          <div className={styles.left}>
            <MobileMenu />
            <NavLinks />
          </div>
          <Link href="/" aria-label="Folio home" data-folio-brand-target className={styles.wordmark}>FOLIO</Link>
          <div className={styles.right}>
            <div className={styles.desktopSearch}><GlobalSearch placeholder="Search Folio" /></div>
            <Link href="/search" aria-label="Search Folio" className={`${styles.iconButton} ${styles.mobileOnly}`}>
              <Search aria-hidden="true" size={18} strokeWidth={1.5} />
            </Link>
            <div className={styles.desktopOnly}><CreateButton workspace={workspace} /></div>
            <NotificationBell />
            <UserMenu workspaceData={workspace} signedOutHref={signedOutHref} />
          </div>
        </nav>
      </div>
    </header>
  );
}
