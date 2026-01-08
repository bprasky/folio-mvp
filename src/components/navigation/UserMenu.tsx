"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { UserAvatar } from "./UserAvatar";
import { 
  ChevronDown, 
  Folder,
  Users, 
  Settings, 
  LogOut,
  Layout,
  User as UserIcon,
  Mail
} from "lucide-react";
import { normalizeRole } from "@/lib/permissions";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full p-1 hover:bg-neutral-50 transition-colors"
        aria-label="User menu"
      >
        <UserAvatar
          src={user.image}
          alt={user.name || "User"}
          size="sm"
        />
        <ChevronDown className={`h-4 w-4 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-neutral-200 bg-white shadow-lg py-2 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-sm font-medium text-neutral-900 truncate">
              {user.name || "User"}
            </p>
            <p className="text-xs text-neutral-500 truncate">
              {user.email}
            </p>
          </div>

          {/* Role-specific links */}
          <div className="py-2">
            {isDesigner && (
              <>
                <MenuLink 
                  href="/designer/projects" 
                  icon={<Folder className="h-4 w-4" />}
                  onClick={() => setIsOpen(false)}
                >
                  Projects
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

            {/* Dashboard link for authenticated users (except designers) */}
            {['ADMIN', 'VENDOR', 'STUDENT'].includes(role) && (
              <MenuLink
                href={getDashboardLink(role)}
                icon={<Layout className="h-4 w-4" />}
                onClick={() => setIsOpen(false)}
              >
                Dashboard
              </MenuLink>
            )}
          </div>

          {/* Common links */}
          <div className="border-t border-neutral-100 py-2">
            <MenuLink
              href={getProfileLink()}
              icon={<UserIcon className="h-4 w-4" />}
              onClick={() => setIsOpen(false)}
            >
              My Profile
            </MenuLink>
            {!isDesigner && (
              <>
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
              </>
            )}
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

