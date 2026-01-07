"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/magazine", label: "Magazine" },
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
              "px-4 py-2 text-sm font-medium rounded-full transition-colors",
              isActive
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

