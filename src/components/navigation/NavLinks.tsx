"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Main Nav = Discovery (everyone else's content)
const links = [
  { href: "/magazine", label: "Magazine" },
  { href: "/about", label: "About" },
  { href: "/professionals", label: "For Professionals" },
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
            {...(link.href === "/professionals" ? { "data-folio-target": "for-professionals-nav" } : {})}
            className={cn(
              "px-4 py-2 folio-ui rounded-full transition-colors",
              isActive
                ? "bg-surface-ground text-folio-text-primary"
                : "text-folio-text-secondary hover:text-folio-text-primary hover:bg-surface-ground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

