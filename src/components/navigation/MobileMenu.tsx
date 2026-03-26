"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Plus, FileText, Package, FolderPlus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "./UserAvatar";
import { normalizeRole } from "@/lib/permissions";
import { CreateCollaborationModal } from "@/components/collaboration/CreateCollaborationModal";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCollaborationModal, setShowCollaborationModal] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;
  const role = user?.role ? normalizeRole(user.role) : null;
  const operatingAsOrgType = session?.user?.operatingAsOrg?.type;

  // Check if user is effectively a designer (by base role OR org membership)
  const isDesigner = role === "DESIGNER" || operatingAsOrgType === "DESIGN_FIRM";

  // Check if user is effectively a vendor (by base role OR org membership)
  const isVendor = role === "VENDOR" ||
    operatingAsOrgType === "VENDOR" ||
    operatingAsOrgType === "MANUFACTURER" ||
    operatingAsOrgType === "SHOWROOM";

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

  // Get profile link based on role and org membership
  const getProfileLink = () => {
    if (!user) return "/profile";
    if (isDesigner) {
      return "/designer/profile";
    }
    if (isVendor) return "/vendor";
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

          {/* Create Section - Role-based */}
          {user && (
            <div className="py-2 border-b border-[var(--ridge-outer)]">
              {isVendor ? (
                <>
                  <p className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                    Create
                  </p>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setShowCollaborationModal(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 folio-ui text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <FileText className="h-4 w-4 text-[var(--text-secondary)]" />
                    Collaboration Story
                  </button>
                  <MobileNavLink href="/vendor/products/new" onClick={() => setIsOpen(false)}>
                    <span className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-[var(--text-secondary)]" />
                      Add Product
                    </span>
                  </MobileNavLink>
                  <MobileNavLink href="/vendor/create-project" onClick={() => setIsOpen(false)}>
                    <span className="flex items-center gap-3">
                      <FolderPlus className="h-4 w-4 text-[var(--text-secondary)]" />
                      Project Handoff
                    </span>
                  </MobileNavLink>
                </>
              ) : (
                <MobileNavLink href="/projects/new" onClick={() => setIsOpen(false)}>
                  <span className="flex items-center gap-3">
                    <Plus className="h-4 w-4" />
                    Create Project
                  </span>
                </MobileNavLink>
              )}
            </div>
          )}

          {/* Mobile nav links */}
          <nav className="py-2">
            <MobileNavLink href="/magazine" onClick={() => setIsOpen(false)}>
              Magazine
            </MobileNavLink>
            <MobileNavLink href="/directory" onClick={() => setIsOpen(false)}>
              Directory
            </MobileNavLink>
            <MobileNavLink href="/events" onClick={() => setIsOpen(false)}>
              Events
            </MobileNavLink>
            <MobileNavLink href="/about" onClick={() => setIsOpen(false)}>
              About
            </MobileNavLink>
            <MobileNavLink href="/for-designers" onClick={() => setIsOpen(false)}>
              For Designers
            </MobileNavLink>

            {isDesigner && (
              <>
                <div className="border-t border-[var(--ridge-outer)] my-2" />
                <MobileNavLink href="/designer/projects" onClick={() => setIsOpen(false)}>
                  Projects
                </MobileNavLink>
                <MobileNavLink href="/designer/directory" onClick={() => setIsOpen(false)}>
                  Vendor Products
                </MobileNavLink>
              </>
            )}

            {isVendor && (
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

            {user && (isDesigner || isVendor || role === "ADMIN" || role === "STUDENT") && (
              <>
                <div className="border-t border-[var(--ridge-outer)] my-2" />
                <MobileNavLink
                  href={isDesigner ? "/designer/dashboard" : isVendor ? "/vendor/dashboard" : getDashboardLink(role || "")}
                  onClick={() => setIsOpen(false)}
                >
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

      {/* Collaboration Modal for Vendors */}
      <CreateCollaborationModal
        open={showCollaborationModal}
        onOpenChange={setShowCollaborationModal}
      />
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

