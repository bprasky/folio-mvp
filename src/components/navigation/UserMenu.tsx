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
  Mail,
  Headphones,
  Building2,
  Briefcase,
  Check
} from "lucide-react";
import SupportModal from "../SupportModal";
import { normalizeRole } from "@/lib/permissions";

interface Organization {
  id: string;
  name: string;
  logo: string | null;
  type?: string;
  userRole?: string;
}

interface WorkspaceContextData {
  operatingAsOrgId: string | null;
  operatingAsOrg: Organization | null;
  organizations: Organization[];
  user: {
    id: string;
    name: string;
    email: string;
    profileImage: string | null;
  };
}

export function UserMenu() {
  const { data: session, status, update } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [workspaceData, setWorkspaceData] = useState<WorkspaceContextData | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
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

  // Fetch workspace context when menu opens
  useEffect(() => {
    if (isOpen && session?.user?.id && !workspaceData) {
      fetchWorkspaceContext();
    }
  }, [isOpen, session?.user?.id]);

  const fetchWorkspaceContext = async () => {
    setIsLoadingWorkspace(true);
    try {
      const response = await fetch('/api/user/workspace-context');
      if (response.ok) {
        const data = await response.json();
        setWorkspaceData(data);
      }
    } catch (error) {
      console.error('Error fetching workspace context:', error);
    } finally {
      setIsLoadingWorkspace(false);
    }
  };

  const handleWorkspaceChange = async (orgId: string | null) => {
    try {
      const response = await fetch('/api/user/workspace-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatingAsOrgId: orgId }),
      });

      if (response.ok) {
        const data = await response.json();
        setWorkspaceData(prev => prev ? {
          ...prev,
          operatingAsOrgId: data.user.operatingAsOrgId,
          operatingAsOrg: data.user.operatingAsOrg,
        } : null);
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

  // Function to handle Sign In with session cleanup
  async function goToSigninFresh() {
    try {
      await signOut({ redirect: false });
      await fetch("/auth/logout", { method: "POST" });
    } catch {}
    window.location.replace("/auth/signin");
  }

  if (status === "loading") {
    return (
      <div className="h-10 w-10 rounded-full bg-neutral-100 animate-pulse" />
    );
  }

  if (!session?.user) {
    return (
      <button
        onClick={goToSigninFresh}
        className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-full hover:bg-neutral-800 transition-colors"
      >
        Sign In
      </button>
    );
  }

  const user = session.user;
  const role = normalizeRole(user.role);
  const isDesigner = role === "DESIGNER";
  const isVendor = role === "VENDOR";
  const isAdmin = role === "ADMIN";

  // Get profile link based on role
  const getProfileLink = () => {
    if (role === "DESIGNER") {
      // Try to generate username from email
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

  // Determine if user has any orgs
  const hasOrgs = workspaceData && workspaceData.organizations.length > 0;
  const currentOrg = workspaceData?.operatingAsOrg;
  const operatingAsOrgId = workspaceData?.operatingAsOrgId || session.user.operatingAsOrgId;

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
        className="flex items-center gap-2 rounded-full p-1 hover:bg-neutral-50 transition-colors"
        aria-label="User menu"
      >
        <UserAvatarWithBadge
          src={user.image}
          alt={user.name || "User"}
          size="sm"
          firmLogo={session.user.operatingAsOrg?.logo}
        />
        <ChevronDown className={`h-4 w-4 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-neutral-200 bg-white shadow-lg py-2 z-50">
          {/* User info header */}
          <div className="px-4 py-3 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <UserAvatarWithBadge
                src={user.image}
                alt={user.name || "User"}
                size="md"
                firmLogo={session.user.operatingAsOrg?.logo}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {user.name || "User"}
                </p>
                <p className="text-xs text-neutral-500 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Primary actions: My Profile, My Projects, Firm */}
          <div className="py-2 border-b border-neutral-100">
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
                href={`/organization/${workspaceData.organizations[0]?.id}/settings`}
                icon={<Building2 className="h-4 w-4" />}
                onClick={() => setIsOpen(false)}
              >
                {workspaceData.organizations[0]?.name || "My Firm"}
              </MenuLink>
            ) : (
              <MenuLink
                href="/professionals/designer/organization"
                icon={<Briefcase className="h-4 w-4" />}
                onClick={() => setIsOpen(false)}
              >
                Go Professional
              </MenuLink>
            )}
          </div>

          {/* Operating As dropdown - only show if user has orgs */}
          {hasOrgs && (
            <div className="py-2 px-4 border-b border-neutral-100">
              <p className="text-xs text-neutral-500 mb-2">Operating as:</p>
              <div ref={workspaceRef} className="relative">
                <button
                  onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-900 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <span className="truncate">{getOperatingAsLabel()}</span>
                  <ChevronDown className={`h-4 w-4 text-neutral-500 ml-2 transition-transform ${isWorkspaceDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isWorkspaceDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-10">
                    {/* Individual option */}
                    <button
                      onClick={() => handleWorkspaceChange(null)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <span>{user.name || "Individual"}</span>
                      {!operatingAsOrgId && <Check className="h-4 w-4 text-neutral-900" />}
                    </button>

                    {/* Organization options */}
                    {workspaceData?.organizations.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => handleWorkspaceChange(org.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                      >
                        <span className="truncate">{org.name}</span>
                        {operatingAsOrgId === org.id && <Check className="h-4 w-4 text-neutral-900" />}
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
              <>
                <MenuLink
                  href="/projects"
                  icon={<Folder className="h-4 w-4" />}
                  onClick={() => setIsOpen(false)}
                >
                  My Projects
                </MenuLink>
                <MenuLink 
                  href="/designer/directory" 
                  icon={<Users className="h-4 w-4" />}
                  onClick={() => setIsOpen(false)}
                >
                  Directory
                </MenuLink>
              </>
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
              href="/messages"
              icon={<Mail className="h-4 w-4" />}
              onClick={() => setIsOpen(false)}
            >
              Messages
            </MenuLink>

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
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
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
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
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
      className="flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
    >
      {icon}
      {children}
    </Link>
  );
}
