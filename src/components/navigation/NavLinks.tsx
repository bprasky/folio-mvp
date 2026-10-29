"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./navigation.module.css";

export function NavLinks() {
  const pathname = usePathname();
  return <div className={styles.desktopOnly}><Link href="/about" aria-current={pathname === "/about" ? "page" : undefined} className={styles.textLink}>About</Link></div>;
}
