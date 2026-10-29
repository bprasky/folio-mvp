"use client";

import { useState, useRef, useEffect, useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Sparkles,
  Plus,
  FileText,
  Package,
  FolderPlus
} from "lucide-react";
import SupportModal from "../SupportModal";
import { normalizeRole } from "@/lib/permissions";
import type { NavigationWorkspace } from "./useNavigationWorkspace";
import { projectEntryHref } from "@/lib/onboarding/professional-entry";
import { CreateCollaborationModal } from "@/components/collaboration/CreateCollaborationModal";
import { InboxButton } from "./InboxButton";
import { BadgeButton } from "./BadgeButton";
import styles from "./navigation.module.css";

export function UserMenu({ workspaceData, signedOutHref = "/auth/signin" }: {
  workspaceData: NavigationWorkspace | null;
  signedOutHref?: string;
}) {
  const { data: session, status, update } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [showCollaborationModal, setShowCollaborationModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => { setIsOpen(false); setIsWorkspaceDropdownOpen(false); }, [pathname, session?.user?.id]);
  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setIsWorkspaceDropdownOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen]);

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

  const closeForDialog = () => {
    setIsOpen(false);
    // Dialogs return focus here instead of to an item in the hidden menu.
    buttonRef.current?.focus();
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
        className={styles.login}
      >
        Log in
      </Link>
    );
  }

  const user = session.user;
  const role = normalizeRole(user.role);
  const isAdmin = role === "ADMIN";

  // Determine if user has any orgs
  const hasOrgs = workspaceData?.user.id === user.id && workspaceData.organizations.length > 0;
  const currentOrg = workspaceData?.operatingAsOrg;
  const operatingAsOrgId = workspaceData?.operatingAsOrgId;

  // Check if user is effectively a designer (by base role OR org membership)
  const projectFirmTypes = ["DESIGN_FIRM", "ARCHITECTURE_FIRM", "CONTRACTOR"];
  const isDesigner = ["DESIGNER", "ARCHITECT", "BUILDER"].includes(role) ||
    projectFirmTypes.includes(currentOrg?.type || "") ||
    workspaceData?.organizations?.some(org => projectFirmTypes.includes(org.type || ""));

  // Check if user is effectively a vendor (by base role OR org membership)
  const isVendor = role === "VENDOR" ||
    currentOrg?.type === "VENDOR" ||
    currentOrg?.type === "MANUFACTURER" ||
    currentOrg?.type === "SHOWROOM" ||
    session.user.operatingAsOrg?.type === "VENDOR" ||
    session.user.operatingAsOrg?.type === "MANUFACTURER" ||
    session.user.operatingAsOrg?.type === "SHOWROOM";
  const createsVendorContent = currentOrg?.type
    ? ["VENDOR", "MANUFACTURER", "SHOWROOM"].includes(currentOrg.type)
    : role === "VENDOR";

  // Get profile link based on role and org membership
  const getProfileLink = () => {
    if (currentOrg) return projectFirmTypes.includes(currentOrg.type || "") ? "/designer/profile" : isVendor ? "/vendor" : `/org/${currentOrg.id}`;
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
    <div key={user.id} ref={menuRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={styles.accountButton}
        aria-label="User menu"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <UserAvatarWithBadge
          src={user.image}
          alt={user.name || "User"}
          size="md"
        />
      </button>

      {/* Keep portal-backed badge dialogs mounted when the menu closes. */}
        <div
          id={panelId}
          hidden={!isOpen}
          aria-label="Account menu"
          className={styles.popover}
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

          {hasOrgs && <div className={`${styles.mobileOnly} flex-col py-2 border-b border-folio-border-subtle`}>
            {createsVendorContent ? <>
              <button type="button" className={styles.menuAction} onClick={() => { closeForDialog(); setShowCollaborationModal(true); }}><FileText className="h-4 w-4" />Collaboration Story</button>
              <MenuLink href="/vendor/products/new" icon={<Package className="h-4 w-4" />} onClick={() => setIsOpen(false)}>Add Product</MenuLink>
              <MenuLink href="/vendor/create-project" icon={<FolderPlus className="h-4 w-4" />} onClick={() => setIsOpen(false)}>Project Handoff</MenuLink>
            </> : <MenuLink href={projectEntryHref({ operatingAsOrgId })} icon={<Plus className="h-4 w-4" />} onClick={() => setIsOpen(false)}>Create Project</MenuLink>}
          </div>}

          {/* Primary account actions */}
          <div className="py-2 border-b border-folio-border-subtle">
            <MenuLink
              href={getProfileLink()}
              icon={<UserIcon className="h-4 w-4" />}
              onClick={() => setIsOpen(false)}
            >
              My Profile
            </MenuLink>

            {hasOrgs && <MenuLink
              href="/designer/projects"
              icon={<Folder className="h-4 w-4" />}
              onClick={() => setIsOpen(false)}
            >
              My Projects
            </MenuLink>}

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

            <InboxButton onNavigate={() => setIsOpen(false)} />
            <BadgeButton onOpen={closeForDialog} />

            <MenuLink
              href="/settings"
              icon={<Settings className="h-4 w-4" />}
              onClick={() => setIsOpen(false)}
            >
              Settings
            </MenuLink>

            <button
              onClick={() => {
                closeForDialog();
                setIsSupportModalOpen(true);
              }}
              className={styles.menuAction}
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
              className={styles.menuAction}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>

      <CreateCollaborationModal open={showCollaborationModal} onOpenChange={setShowCollaborationModal} />

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
      className={styles.menuAction}
    >
      {icon}
      {children}
    </Link>
  );
}
