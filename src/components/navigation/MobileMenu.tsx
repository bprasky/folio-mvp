"use client";

import { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import styles from "./navigation.module.css";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => { setIsOpen(false); }, [pathname]);
  useEffect(() => {
    if (!isOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setIsOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [isOpen]);

  return (
    <div ref={ref} className={`relative ${styles.mobileOnly}`}>
      <button ref={buttonRef} type="button" onClick={() => setIsOpen(open => !open)} className={styles.iconButton}
        aria-label="Toggle menu" aria-expanded={isOpen} aria-controls={panelId}>
        {isOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} strokeWidth={1.5} aria-hidden="true" />}
      </button>
      {isOpen && <div id={panelId} className={`${styles.popover} ${styles.mobilePopover}`}>
        <Link href="/about" onClick={() => setIsOpen(false)} className={styles.menuAction}>About Folio</Link>
      </div>}
    </div>
  );
}
