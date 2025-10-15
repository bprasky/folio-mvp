'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FaHome, FaLightbulb, FaNewspaper, FaStore, FaUsers, FaUser, FaPlus, FaBriefcase, FaGraduationCap, FaChalkboardTeacher, FaUserGraduate, FaStar, FaVideo, FaCompass, FaChartLine, FaChartBar, FaFolder, FaHeart, FaEnvelope, FaShoppingCart, FaBook, FaCog, FaFileAlt, FaBox, FaChevronDown, FaChevronRight, FaCalendarAlt, FaCamera, FaSignOutAlt } from 'react-icons/fa';
import FolioLogo from './FolioLogo';
import { LogoutButton } from './LogoutButton';
import { getCreateTarget, canCreateProject, normalizeRole } from '@/lib/permissions';
import { signOut } from 'next-auth/react';
import CreateProjectChooser from './CreateProjectChooser';
import DesignerInbox from './DesignerInbox';

const Navigation = () => {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isCommunityExpanded, setIsCommunityExpanded] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [showCreateChooser, setShowCreateChooser] = useState(false);

  // Get normalized role from session using centralized logic
  const role = normalizeRole(session?.user?.role);

  // Function to handle Sign In with session cleanup
  async function goToSigninFresh() {
    try {
      // end any current/stale session (idempotent)
      await signOut({ redirect: false });
      await fetch('/auth/logout', { method: 'POST' });
    } catch {}
    // hard redirect to the signin page
    window.location.replace('/auth/signin');
  }

  const baseNavItems = [
    { href: '/', icon: FaHome, label: 'Home' },
    { href: '/editorials', icon: FaNewspaper, label: 'Editorials' },
    // Temporarily hidden: { href: '/inspire', icon: FaLightbulb, label: 'Inspire' },
    // Temporarily hidden: { href: '/vendor', icon: FaStore, label: 'Shop' },
    // Temporarily hidden: { href: '/watch', icon: FaVideo, label: 'Watch' },
  ];

  // Community section with collapsible events
  const communitySection = {
    main: { href: '/community', icon: FaUsers, label: 'Community' },
    submenu: [
      { href: '/events', icon: FaCalendarAlt, label: 'Events' },
    ]
  };

  // Profile section items based on role
  const getProfileItems = () => {
    if (!session?.user) {
      // Show sign in option when not logged in
      return [
        { name: 'Sign In', href: '#', icon: FaUser, isSignIn: true, isLogout: false },
      ];
    }

    // Defensive coding: if role is undefined, don't show role-specific items
    if (!session?.user?.role) {
      return [
        { name: 'My Profile', href: '/profile', icon: FaUser, isSignIn: false, isLogout: false },
        { name: 'Sign Out', href: '#', icon: FaSignOutAlt, isSignIn: false, isLogout: true },
      ];
    }

    // Show profile options when logged in
    const baseProfileItems = [
      { name: 'My Profile', href: '/profile', icon: FaUser, isSignIn: false, isLogout: false },
      { name: 'Messages', href: '/messages', icon: FaEnvelope, isSignIn: false, isLogout: false },
      { name: 'Sign Out', href: '#', icon: FaSignOutAlt, isSignIn: false, isLogout: true },
    ];

    // Only add Dashboard for specific roles
    const userRole = normalizeRole(session.user.role);
    if (['ADMIN', 'VENDOR', 'DESIGNER', 'STUDENT'].includes(userRole || '')) {
      baseProfileItems.splice(1, 0, { name: 'Dashboard', href: getDashboardLink(), icon: FaChartLine, isSignIn: false, isLogout: false });
    }

    return baseProfileItems;
  };

  // Get dashboard link based on user role
  const getDashboardLink = () => {
    switch (role) {
      case 'DESIGNER':
        return '/designer/dashboard';
      case 'VENDOR':
        return '/vendor/dashboard';
      case 'ADMIN':
        return '/admin/dashboard';
      default:
        return '/'; // Fallback to homepage
    }
  };

  // Navigation items for different roles (excluding dashboard, analytics, messages)
  const homeownerItems: Array<{name: string; href: string; icon: any}> = [];

  const designerItems = [
    { name: 'Projects', href: '/projects', icon: FaBriefcase },
  ];

  const vendorItems = [
    { name: 'Projects', href: '/vendor/dashboard', icon: FaBriefcase },
    { name: 'Products', href: '/vendor/products', icon: FaBox },
    { name: 'Orders', href: '/vendor/orders', icon: FaShoppingCart },
  ];

  const studentItems = [
    { name: 'Explore', href: '/student', icon: FaGraduationCap },
    { name: 'Classes', href: '/student/classes', icon: FaBook },
    { name: 'Mentorship', href: '/student/mentorship', icon: FaUsers },
    { name: 'Portfolio', href: '/student/portfolio', icon: FaBriefcase },
  ];

  const adminItems: Array<{name: string; href: string; icon: any}> = [
    // Temporarily hidden: { name: 'Users', href: '/admin/users', icon: FaUsers },
    // Temporarily hidden: { name: 'Content', href: '/admin/content', icon: FaFileAlt },
    // Temporarily hidden: { name: 'Vendor Analytics', href: '/admin/vendor-analytics', icon: FaChartBar },
  ];

  // Role-based profile link configuration
  const getProfileLink = () => {
    switch (role) {
      case 'DESIGNER':
        return '/designer/profile';
      case 'VENDOR':
        return '/vendor';
      case 'STUDENT':
        return '/student';
      case 'ADMIN':
        return '/admin';
      case 'HOMEOWNER':
      default:
        return '/homeowner';
    }
  };

  // Get role-specific items
  const getRoleItems = () => {
    // Defensive coding: if no session or no role, return empty array
    if (!session?.user?.role) {
      return [];
    }

    const userRole = normalizeRole(session.user.role);
    
    switch (userRole) {
      case 'HOMEOWNER':
        return homeownerItems;
      case 'DESIGNER':
        return designerItems;
      case 'VENDOR':
        return vendorItems;
      case 'STUDENT':
        return studentItems;
      case 'ADMIN':
        return adminItems;
      default:
        // Don't fallback to homeownerItems for undefined roles
        return [];
    }
  };

  const roleItems = getRoleItems();
  const profileItems = getProfileItems();

  // Get create button configuration using centralized logic
  const createCfg = getCreateTarget(role);

  // Debug logging - after all variables are declared
  console.log('Navigation Debug:', {
    sessionStatus: status,
    sessionRole: session?.user?.role,
    finalRole: role,
    user: session?.user?.name || session?.user?.email,
    isAuthenticated: !!session?.user,
    roleItems: roleItems.length,
    createButtonLabel: typeof createCfg === 'object' && createCfg !== null ? (createCfg as any)?.label : createCfg,
    roleItemsArray: roleItems.map(item => item.name)
  });
  
  // Additional debug logging for session role
  console.log('SESSION ROLE:', session?.user?.role);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const isCommunityActive = () => {
    return pathname?.startsWith('/community') || pathname?.startsWith('/events');
  };

  const isProfileActive = () => {
    return profileItems.some(item => isActive(item.href)) || isActive(getProfileLink());
  };

  // Show loading state while session is being determined
  if (status === 'loading') {
    return (
      <div className="bg-white border-r border-folio-border w-64 p-6 h-screen flex flex-col shadow-sm">
        <div className="mb-8">
          <FolioLogo size="md" variant="combined" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        {/* Placeholder for Sign In button slot to avoid layout jump */}
        <div className="mt-6 pt-6 border-t border-folio-border">
          <div className="p-3 rounded-lg bg-gray-100 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-r border-folio-border w-full h-full p-6 flex flex-col shadow-sm nav-scrollbar">
      {/* Logo */}
      <div className="mb-8">
        <FolioLogo size="md" variant="combined" />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col space-y-2">
        {/* Base Navigation Items */}
        {baseNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`p-3 rounded-lg flex items-center w-full transition-all duration-200 nav-focus-visible ${
                active
                  ? 'bg-folio-accent text-white shadow-sm'
                  : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
              }`}
            >
              <Icon className="text-lg" />
              <span className="ml-3 font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Community Section with Collapsible Events */}
        <div className="w-full">
          <button
            onClick={() => setIsCommunityExpanded(!isCommunityExpanded)}
            className={`p-3 rounded-lg flex items-center w-full transition-all duration-200 nav-focus-visible ${
              isCommunityActive()
                ? 'bg-folio-accent text-white shadow-sm'
                : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
            }`}
          >
            <FaUsers className="text-lg" />
            <span className="ml-3 font-medium flex-1 text-left">Community</span>
            <span className="ml-2">
              {isCommunityExpanded ? <FaChevronDown className="text-sm" /> : <FaChevronRight className="text-sm" />}
            </span>
          </button>
          
          {/* Submenu */}
          {isCommunityExpanded && (
            <div className="mt-1 ml-6 space-y-1">
              {communitySection.submenu.map((subItem) => {
                const SubIcon = subItem.icon;
                const active = isActive(subItem.href);
                
                return (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={`p-2 rounded-lg flex items-center w-full transition-all duration-200 text-sm ${
                      active
                        ? 'bg-folio-accent text-white shadow-sm'
                        : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
                    }`}
                  >
                    <SubIcon className="text-base" />
                    <span className="ml-3 font-medium">{subItem.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Role-specific Items - Only show for authenticated users */}
        {session?.user && roleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`p-3 rounded-lg flex items-center w-full transition-all duration-200 nav-focus-visible ${
                active
                  ? 'bg-folio-accent text-white shadow-sm'
                  : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
              }`}
            >
              <Icon className="text-lg" />
              <span className="ml-3 font-medium">{item.name}</span>
            </Link>
          );
        })}

        {/* Profile Section with Collapsible Items */}
        <div className="w-full">
          <div
            className={`p-3 rounded-lg flex items-center w-full transition-all duration-200 ${
              isProfileActive()
                ? 'bg-folio-accent text-white shadow-sm'
                : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
            }`}
          >
            <Link
              href={getProfileLink()}
              className="flex items-center flex-1"
            >
              <FaUser className="text-lg" />
              <span className="ml-3 font-medium text-left">Profile</span>
            </Link>
            <button
              onClick={() => setIsProfileExpanded(!isProfileExpanded)}
              className="ml-2 p-1 hover:bg-black hover:bg-opacity-10 rounded"
            >
              {isProfileExpanded ? <FaChevronDown className="text-sm" /> : <FaChevronRight className="text-sm" />}
            </button>
          </div>
          
          {/* Profile Submenu */}
          {isProfileExpanded && (
            <div className="mt-1 ml-6 space-y-1">
                            {profileItems.map((item) => {
                const SubIcon = item.icon;
                const active = isActive(item.href);
                
                if (item.isLogout) {
                  return (
                    <div key={item.href}>
                      <LogoutButton />
                    </div>
                  );
                }
                
                if (item.isSignIn) {
                  return (
                    <button
                      key={item.href}
                      onClick={goToSigninFresh}
                      className="p-2 rounded-lg flex items-center w-full transition-all duration-200 text-sm text-folio-text hover:bg-folio-muted hover:text-folio-text"
                    >
                      <SubIcon className="text-base" />
                      <span className="ml-3 font-medium">{item.name}</span>
                    </button>
                  );
                }
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`p-2 rounded-lg flex items-center w-full transition-all duration-200 text-sm ${
                      active
                        ? 'bg-folio-accent text-white shadow-sm'
                        : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
                    }`}
                  >
                    <SubIcon className="text-base" />
                    <span className="ml-3 font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Role-specific Create Button - Only show for authenticated users with create permissions */}
      {session?.user && createCfg && canCreateProject(role) && (
        <>
          {role === 'DESIGNER' ? (
            <button
              onClick={() => setShowCreateChooser(true)}
              className="w-full py-3 px-4 rounded-lg font-medium items-center justify-center mt-6 transition-all duration-200 hover:shadow-md bg-folio-text text-white hover:bg-opacity-90 nav-focus-visible"
            >
              <FaPlus className="mr-2" /> {typeof createCfg === 'object' && createCfg !== null ? (createCfg as any).label : createCfg}
            </button>
          ) : (
            <Link
              href={typeof createCfg === 'object' && createCfg !== null ? (createCfg as any).href : '#'}
              className="w-full py-3 px-4 rounded-lg font-medium items-center justify-center mt-6 transition-all duration-200 hover:shadow-md bg-folio-text text-white hover:bg-opacity-90 nav-focus-visible"
            >
              <FaPlus className="mr-2" /> {typeof createCfg === 'object' && createCfg !== null ? (createCfg as any).label : createCfg}
            </Link>
          )}
        </>
      )}

      {/* Create Project Chooser Modal */}
      {showCreateChooser && (
        <CreateProjectChooser onClose={() => setShowCreateChooser(false)} />
      )}

      {/* User Logout Section */}
      {session?.user && (
        <div className="mt-6 pt-6 border-t border-folio-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 gradient-to-r from-folio-accent to-folio-system rounded-full flex items-center justify-center">
              <FaUser className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-folio-text truncate">{session.user.name || session.user.email}</p>
              <p className="text-xs text-folio-system capitalize">{session.user.role}</p>
              {/* Debug role indicator */}
              <p className="text-xs text-gray-400">Detected: {role}</p>
            </div>
          </div>
          
          {/* Designer Inbox - Show for designers */}
          {session?.user?.role === "DESIGNER" && (
            <div className="mb-3">
              <DesignerInbox />
            </div>
          )}
          
          <LogoutButton />
        </div>
      )}
    </div>
  );
};

export default Navigation; 