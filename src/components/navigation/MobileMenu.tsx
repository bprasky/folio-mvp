"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "./UserAvatar";
import { normalizeRole } from "@/lib/permissions";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;
  const role = user?.role ? normalizeRole(user.role) : null;

  // Get dashboard link based on role
  const getDashboardLink = (userRole: string) => {
    switch (userRole) {
      case "DESIGNER":
        return "/designer/dashboard";
      case "VENDOR":
        return "/vendor/dashboard";
      case "ADMIN":
        return "/admin/dashboard";
      default:
        return "/";
    }
  };

  // Get profile link based on role
  const getProfileLink = () => {
    if (!user) return "/profile";
    if (role === "DESIGNER") {
      if (user.email) {
        const emailPrefix = user.email.split("@")[0];
        return `/@${emailPrefix.toLowerCase()}`;
      }
      return "/designer/profile";
    }
    if (role === "VENDOR") return "/vendor";
    if (role === "STUDENT") return "/student";
    if (role === "ADMIN") return "/admin";
    return "/profile";
  };

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="fixed top-16 left-0 right-0 bg-[var(--bg-base)] border-b border-[var(--ridge-outer)] shadow-lg z-50">
          {/* Mobile search */}
          <div className="p-4 border-b border-[var(--ridge-outer)]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                  setIsOpen(false);
                  setSearchQuery("");
                }
              }}
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full h-10 pl-4 pr-4 rounded-full border border-[var(--ridge-outer)] bg-[var(--bg-elevated)] folio-ui"
              />
            </form>
          </div>

          {/* Mobile nav links */}
          <nav className="py-2">
            <MobileNavLink href="/magazine" onClick={() => setIsOpen(false)}>
              Magazine
            </MobileNavLink>
            <MobileNavLink href="/events" onClick={() => setIsOpen(false)}>
              Events
            </MobileNavLink>

            {role === "DESIGNER" && (
              <>
                <div className="border-t border-[var(--ridge-outer)] my-2" />
                <MobileNavLink href="/designer/projects" onClick={() => setIsOpen(false)}>
                  Projects
                </MobileNavLink>
                <MobileNavLink href="/designer/directory" onClick={() => setIsOpen(false)}>
                  Directory
                </MobileNavLink>
              </>
            )}

            {role === "VENDOR" && (
              <>
                <div className="border-t border-[var(--ridge-outer)] my-2" />
                <MobileNavLink href="/vendor/dashboard" onClick={() => setIsOpen(false)}>
                  Dashboard
                </MobileNavLink>
              </>
            )}

            {role === "ADMIN" && (
              <>
                <div className="border-t border-[var(--ridge-outer)] my-2" />
                <MobileNavLink href="/admin" onClick={() => setIsOpen(false)}>
                  Admin Panel
                </MobileNavLink>
              </>
            )}

            {user && role && ['ADMIN', 'VENDOR', 'DESIGNER', 'STUDENT'].includes(role) && (
              <>
                <div className="border-t border-[var(--ridge-outer)] my-2" />
                <MobileNavLink href={getDashboardLink(role)} onClick={() => setIsOpen(false)}>
                  Dashboard
                </MobileNavLink>
              </>
            )}
          </nav>

          {/* User section */}
          {user && (
            <div className="p-4 border-t border-[var(--ridge-outer)] flex items-center gap-3">
              <UserAvatar src={user.image} alt={user.name || "User"} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="folio-ui text-[var(--text-primary)] truncate">{user.name || "User"}</p>
                <p className="folio-meta text-[var(--text-secondary)] truncate">{user.email}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MobileNavLinkProps {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}

function MobileNavLink({ href, children, onClick }: MobileNavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-3 folio-ui text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
    >
      {children}
    </Link>
  );
}

