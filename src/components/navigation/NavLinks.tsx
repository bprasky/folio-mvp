"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Main Nav = Discovery (everyone else's content)
const links = [
  { href: "/magazine", label: "Magazine" },
  { href: "/directory", label: "Directory" },
  { href: "/events", label: "Events" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="hidden md:flex items-center gap-1">
      {links.map((link) => {
        const isActive = pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-4 py-2 folio-ui rounded-full transition-colors",
              isActive
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

