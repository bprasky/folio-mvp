"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { UserAvatarWithBadge } from "./UserAvatarWithBadge";
import {
  ChevronDown,
  Folder,
  Users,
  Settings,
  LogOut,
  Layout,
  User as UserIcon,
  Headphones,
  Building2,
  Briefcase,
  Check,
  Sparkles
} from "lucide-react";
import SupportModal from "../SupportModal";
import { normalizeRole } from "@/lib/permissions";
import type { NavigationWorkspace } from "./useNavigationWorkspace";

export function UserMenu({ workspaceData, signedOutHref = "/auth/signin" }: {
  workspaceData: NavigationWorkspace | null;
  signedOutHref?: string;
}) {
  const { data: session, status, update } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsWorkspaceDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleWorkspaceChange = async (orgId: string | null) => {
    try {
      const response = await fetch('/api/user/workspace-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatingAsOrgId: orgId }),
      });

      if (response.ok) {
        // Update the session to reflect the change
        await update();
        setIsWorkspaceDropdownOpen(false);
        // Refresh the page to update context-dependent content
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating workspace context:', error);
    }
  };

  if (status === "loading") {
    return (
      <div className="h-10 w-10 rounded-full bg-surface-ground animate-pulse" />
    );
  }

  if (!session?.user) {
    return (
      <Link
        href={signedOutHref}
        aria-label="Sign in / Sign up"
        className="shrink-0 min-h-11 px-3 sm:px-4 py-2 text-xs sm:text-sm leading-tight font-medium text-[var(--surface-canvas)] bg-[var(--text-primary)] rounded-full hover:opacity-90 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="block sm:inline whitespace-nowrap">Sign in<span className="hidden sm:inline"> / </span></span>
        <span className="block sm:inline whitespace-nowrap">Sign up</span>
      </Link>
    );
  }

  const user = session.user;
  const role = normalizeRole(user.role);
  const isAdmin = role === "ADMIN";

  // Determine if user has any orgs
  const hasOrgs = workspaceData && workspaceData.organizations.length > 0;
  const currentOrg = workspaceData?.operatingAsOrg;
  const operatingAsOrgId = workspaceData?.operatingAsOrgId;

  // Check if user is effectively a designer (by base role OR org membership)
  const isDesigner = role === "DESIGNER" ||
    currentOrg?.type === "DESIGN_FIRM" ||
    session.user.operatingAsOrg?.type === "DESIGN_FIRM" ||
    workspaceData?.organizations?.some(org => org.type === "DESIGN_FIRM");

  // Check if user is effectively a vendor (by base role OR org membership)
  const isVendor = role === "VENDOR" ||
    currentOrg?.type === "VENDOR" ||
    currentOrg?.type === "MANUFACTURER" ||
    currentOrg?.type === "SHOWROOM" ||
    session.user.operatingAsOrg?.type === "VENDOR" ||
    session.user.operatingAsOrg?.type === "MANUFACTURER" ||
    session.user.operatingAsOrg?.type === "SHOWROOM";

  // Get profile link based on role and org membership
  const getProfileLink = () => {
    // Check org context first (operating as or membership)
    if (isDesigner) {
      return "/designer/profile";
    }
    if (isVendor) return "/vendor";
    if (role === "STUDENT") return "/student";
    if (isAdmin) return "/admin";
    return "/profile";
  };

  // Get current operating context label
  const getOperatingAsLabel = () => {
    if (operatingAsOrgId && currentOrg) {
      return currentOrg.name;
    }
    return user.name || "Individual";
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full p-1 hover:bg-surface-ground transition-colors"
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <UserAvatarWithBadge
          src={user.image}
          alt={user.name || "User"}
          size="sm"
          firmLogo={session.user.operatingAsOrg?.logo}
        />
        <ChevronDown className={`h-4 w-4 text-folio-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-xl py-2 z-50 glass-overlay"
        >
          {/* User info header */}
          <div className="px-4 py-3 border-b border-folio-border-subtle">
            <div className="flex items-center gap-3">
              <UserAvatarWithBadge
                src={user.image}
                alt={user.name || "User"}
                size="md"
                firmLogo={session.user.operatingAsOrg?.logo}
              />
              <div className="flex-1 min-w-0">
                <p className="folio-ui text-folio-text-primary truncate">
                  {user.name || "User"}
                </p>
                <p className="folio-meta text-folio-text-secondary truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Primary actions: My Profile, My Projects, Firm */}
          <div className="py-2 border-b border-folio-border-subtle">
            <MenuLink
              href={getProfileLink()}
              icon={<UserIcon className="h-4 w-4" />}
              onClick={() => setIsOpen(false)}
            >
              My Profile
            </MenuLink>

            <MenuLink
              href="/designer/projects"
              icon={<Folder className="h-4 w-4" />}
              onClick={() => setIsOpen(false)}
            >
              My Projects
            </MenuLink>

            {/* Firm row: Show firm name or "Go Professional" */}
            {hasOrgs ? (
              <MenuLink
                href={`/org/${workspaceData.organizations[0]?.id}`}
                icon={<Building2 className="h-4 w-4" />}
                onClick={() => setIsOpen(false)}
              >
                {workspaceData.organizations[0]?.name || "My Firm"}
              </MenuLink>
            ) : workspaceData ? (
              <MenuLink
                href="/professionals"
                icon={<Briefcase className="h-4 w-4" />}
                onClick={() => setIsOpen(false)}
              >
                Go Professional
              </MenuLink>
            ) : null}
          </div>

          {/* Operating As dropdown - only show if user has orgs */}
          {hasOrgs && (
            <div className="py-2 px-4 border-b border-folio-border-subtle">
              <p className="folio-meta text-folio-text-secondary mb-2">Operating as:</p>
              <div ref={workspaceRef} className="relative">
                <button
                  onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 folio-ui text-folio-text-primary bg-surface-ground rounded-lg hover:bg-surface-ground transition-colors"
                >
                  <span className="truncate">{getOperatingAsLabel()}</span>
                  <ChevronDown className={`h-4 w-4 text-folio-text-secondary ml-2 transition-transform ${isWorkspaceDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isWorkspaceDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-surface-canvas border border-folio-border-subtle rounded-lg shadow-lg py-1 z-10">
                    {/* Individual option */}
                    <button
                      onClick={() => handleWorkspaceChange(null)}
                      className="w-full flex items-center justify-between px-3 py-2 folio-ui text-folio-text-primary hover:bg-surface-ground transition-colors"
                    >
                      <span>{user.name || "Individual"}</span>
                      {!operatingAsOrgId && <Check className="h-4 w-4 text-folio-text-primary" />}
                    </button>

                    {/* Organization options */}
                    {workspaceData?.organizations.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => handleWorkspaceChange(org.id)}
                        className="w-full flex items-center justify-between px-3 py-2 folio-ui text-folio-text-primary hover:bg-surface-ground transition-colors"
                      >
                        <span className="truncate">{org.name}</span>
                        {operatingAsOrgId === org.id && <Check className="h-4 w-4 text-folio-text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Secondary links */}
          <div className="py-2">
            {isDesigner && (
              <MenuLink
                href="/designer/studio"
                icon={<Sparkles className="h-4 w-4" />}
                onClick={() => setIsOpen(false)}
              >
                Publishing Studio
              </MenuLink>
            )}

            {isDesigner && (
              <MenuLink
                href="/designer/sourcebook"
                icon={<Users className="h-4 w-4" />}
                onClick={() => setIsOpen(false)}
              >
                Sourcebook
              </MenuLink>
            )}

            {isVendor && (
              <MenuLink
                href="/vendor/dashboard"
                icon={<Layout className="h-4 w-4" />}
                onClick={() => setIsOpen(false)}
              >
                Dashboard
              </MenuLink>
            )}

            {isAdmin && (
              <MenuLink
                href="/admin"
                icon={<Layout className="h-4 w-4" />}
                onClick={() => setIsOpen(false)}
              >
                Admin Panel
              </MenuLink>
            )}

            <MenuLink
              href="/settings"
              icon={<Settings className="h-4 w-4" />}
              onClick={() => setIsOpen(false)}
            >
              Settings
            </MenuLink>

            <button
              onClick={() => {
                setIsOpen(false);
                setIsSupportModalOpen(true);
              }}
              className="flex w-full items-center gap-3 px-4 py-2 folio-ui text-folio-text-primary hover:bg-surface-ground transition-colors"
            >
              <Headphones className="h-4 w-4" />
              Support
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                signOut({ redirect: false }).then(() => {
                  window.location.replace("/auth/signin");
                });
              }}
              className="flex w-full items-center gap-3 px-4 py-2 folio-ui text-folio-text-primary hover:bg-surface-ground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Support Modal */}
      <SupportModal
        open={isSupportModalOpen}
        onOpenChange={setIsSupportModalOpen}
      />
    </div>
  );
}

interface MenuLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}

function MenuLink({ href, icon, children, onClick }: MenuLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2 folio-ui text-folio-text-primary hover:bg-surface-ground transition-colors"
    >
      {icon}
      {children}
    </Link>
  );
}
