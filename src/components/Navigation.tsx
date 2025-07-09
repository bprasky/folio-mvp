'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FaHome, FaLightbulb, FaNewspaper, FaStore, FaUsers, FaUser, FaPlus, FaBriefcase, FaGraduationCap, FaChalkboardTeacher, FaUserGraduate, FaStar, FaVideo, FaCompass, FaChartLine, FaChartBar, FaFolder, FaHeart, FaEnvelope, FaShoppingCart, FaBook, FaCog, FaFileAlt, FaBox, FaChevronDown, FaChevronRight, FaCalendarAlt } from 'react-icons/fa';
import { useRole } from '../contexts/RoleContext';

const Navigation = () => {
  const pathname = usePathname();
  const { role } = useRole();
  const [isCommunityExpanded, setIsCommunityExpanded] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);

  const baseNavItems = [
    { href: '/', icon: FaHome, label: 'Home' },
    { href: '/editorials', icon: FaNewspaper, label: 'Editorials' },
    { href: '/inspire', icon: FaLightbulb, label: 'Inspire' },
    { href: '/vendor', icon: FaStore, label: 'Shop' },
    { href: '/watch', icon: FaVideo, label: 'Watch' },
  ];

  // Community section with collapsible events
  const getEventsHref = () => {
    switch (role) {
      case 'admin':
        return '/admin/events/approvals';
      case 'vendor':
        return '/vendors/events/create';
      default:
        return '/events';
    }
  };

  const communitySection = {
    main: { href: '/community', icon: FaUsers, label: 'Community' },
    submenu: [
      { href: getEventsHref(), icon: FaCalendarAlt, label: 'Events' },
    ]
  };

  // Profile section items based on role
  const getProfileItems = () => {
    const baseProfileItems = [
      { name: 'Messages', href: '/messages', icon: FaEnvelope },
    ];

    switch (role) {
      case 'designer':
        return [
          { name: 'Dashboard', href: '/designer', icon: FaChartLine },
          { name: 'Analytics', href: '/designer/analytics', icon: FaChartBar },
          ...baseProfileItems,
        ];
      case 'vendor':
        return [
          { name: 'Dashboard', href: '/vendor', icon: FaStore },
          { name: 'Analytics', href: '/vendor/analytics', icon: FaChartLine },
          ...baseProfileItems,
        ];
      case 'admin':
        return [
          { name: 'Dashboard', href: '/admin', icon: FaCog },
          { name: 'Analytics', href: '/admin/analytics', icon: FaChartBar },
          ...baseProfileItems,
        ];
      case 'homeowner':
      case 'student':
      default:
        return baseProfileItems;
    }
  };

  // Navigation items for different roles (excluding dashboard, analytics, messages)
  const homeownerItems: { name: string; href: string; icon: any }[] = [];

  const designerItems = [
    { name: 'Projects', href: '/designer/projects', icon: FaBriefcase },
  ];

  const vendorItems = [
    { name: 'Products', href: '/vendor/products', icon: FaBox },
    { name: 'Orders', href: '/vendor/orders', icon: FaShoppingCart },
  ];

  const studentItems = [
    { name: 'Explore', href: '/student', icon: FaGraduationCap },
    { name: 'Classes', href: '/student/classes', icon: FaBook },
    { name: 'Mentorship', href: '/student/mentorship', icon: FaUsers },
    { name: 'Portfolio', href: '/student/portfolio', icon: FaBriefcase },
  ];

  const adminItems = [
    { name: 'Users', href: '/admin/users', icon: FaUsers },
    { name: 'Content', href: '/admin/content', icon: FaFileAlt },
  ];

  // Role-based profile link configuration
  const getProfileLink = () => {
    switch (role) {
      case 'designer':
        return '/designer/profile';
      case 'vendor':
        return '/vendor';
      case 'student':
        return '/student';
      case 'admin':
        return '/admin';
      case 'homeowner':
      default:
        return '/homeowner';
    }
  };

  // Get role-specific items
  const getRoleItems = () => {
    switch (role) {
      case 'homeowner':
        return homeownerItems;
      case 'designer':
        return designerItems;
      case 'vendor':
        return vendorItems;
      case 'student':
        return studentItems;
      case 'admin':
        return adminItems;
      default:
        return homeownerItems;
    }
  };

  const roleItems = getRoleItems();
  const profileItems = getProfileItems();

  // Role-based design button configuration
  const getDesignButtonConfig = () => {
    switch (role) {
      case 'homeowner':
        return {
          href: '/homeowner/folders',
          label: 'Create Folder'
        };
      case 'student':
        return {
          href: '/student/create',
          label: 'Create'
        };
      case 'designer':
        return {
          href: '/designer/create-project',
          label: 'Create Project'
        };
      case 'vendor':
        return {
          href: '/vendor/create-product',
          label: 'Add Product'
        };
      case 'admin':
        return {
          href: '/admin/tasks',
          label: 'Admin Tasks'
        };
      default:
        return {
          href: '/homeowner/folders',
          label: 'Create Folder'
        };
    }
  };

  const designButtonConfig = getDesignButtonConfig();

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

  return (
    <div className="bg-white border-r border-folio-border w-20 lg:w-56 p-4 lg:p-6 fixed h-full z-20 flex flex-col items-center lg:items-start shadow-sm">
      {/* Logo */}
      <div className="w-10 h-10 rounded-lg bg-folio-text text-white font-bold text-xl mb-8 flex items-center justify-center shadow-sm">
        F
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col items-center lg:items-start space-y-2">
        {/* Base Navigation Items */}
        {baseNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`p-3 rounded-lg flex flex-col items-center lg:flex-row lg:items-center w-full transition-all duration-200 ${
                active
                  ? 'bg-folio-accent text-white shadow-sm'
                  : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
              }`}
            >
              <Icon className="text-lg" />
              <span className="hidden lg:inline ml-3 font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Community Section with Collapsible Events */}
        <div className="w-full">
          <button
            onClick={() => setIsCommunityExpanded(!isCommunityExpanded)}
            className={`p-3 rounded-lg flex flex-col items-center lg:flex-row lg:items-center w-full transition-all duration-200 ${
              isCommunityActive()
                ? 'bg-folio-accent text-white shadow-sm'
                : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
            }`}
          >
            <FaUsers className="text-lg" />
            <span className="hidden lg:inline ml-3 font-medium flex-1 text-left">Community</span>
            <span className="hidden lg:inline ml-2">
              {isCommunityExpanded ? <FaChevronDown className="text-sm" /> : <FaChevronRight className="text-sm" />}
            </span>
          </button>
          
          {/* Submenu */}
          {isCommunityExpanded && (
            <div className="mt-1 ml-0 lg:ml-6 space-y-1">
              {communitySection.submenu.map((subItem) => {
                const SubIcon = subItem.icon;
                const active = isActive(subItem.href);
                
                return (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={`p-2 rounded-lg flex flex-col items-center lg:flex-row lg:items-center w-full transition-all duration-200 text-sm ${
                      active
                        ? 'bg-folio-accent text-white shadow-sm'
                        : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
                    }`}
                  >
                    <SubIcon className="text-base" />
                    <span className="hidden lg:inline ml-3 font-medium">{subItem.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Role-specific Items */}
        {roleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`p-3 rounded-lg flex flex-col items-center lg:flex-row lg:items-center w-full transition-all duration-200 ${
                active
                  ? 'bg-folio-accent text-white shadow-sm'
                  : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
              }`}
            >
              <Icon className="text-lg" />
              <span className="hidden lg:inline ml-3 font-medium">{item.name}</span>
            </Link>
          );
        })}

        {/* Profile Section with Collapsible Items */}
        <div className="w-full">
          <div
            className={`p-3 rounded-lg flex flex-col items-center lg:flex-row lg:items-center w-full transition-all duration-200 ${
              isProfileActive()
                ? 'bg-folio-accent text-white shadow-sm'
                : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
            }`}
          >
            <Link
              href={getProfileLink()}
              className="flex flex-col items-center lg:flex-row lg:items-center flex-1"
            >
              <FaUser className="text-lg" />
              <span className="hidden lg:inline ml-3 font-medium text-left">Profile</span>
            </Link>
            <button
              onClick={() => setIsProfileExpanded(!isProfileExpanded)}
              className="hidden lg:inline ml-2 p-1 hover:bg-black hover:bg-opacity-10 rounded"
            >
              {isProfileExpanded ? <FaChevronDown className="text-sm" /> : <FaChevronRight className="text-sm" />}
            </button>
          </div>
          
          {/* Profile Submenu */}
          {isProfileExpanded && (
            <div className="mt-1 ml-0 lg:ml-6 space-y-1">
              {profileItems.map((item) => {
                const SubIcon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`p-2 rounded-lg flex flex-col items-center lg:flex-row lg:items-center w-full transition-all duration-200 text-sm ${
                      active
                        ? 'bg-folio-accent text-white shadow-sm'
                        : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
                    }`}
                  >
                    <SubIcon className="text-base" />
                    <span className="hidden lg:inline ml-3 font-medium">{item.name}</span>
                  </Link>
                );
              })}
              
              {/* Profile Settings Link */}
              <Link
                href={getProfileLink()}
                className={`p-2 rounded-lg flex flex-col items-center lg:flex-row lg:items-center w-full transition-all duration-200 text-sm ${
                  isActive(getProfileLink())
                    ? 'bg-folio-accent text-white shadow-sm'
                    : 'text-folio-text hover:bg-folio-muted hover:text-folio-text'
                }`}
              >
                <FaCog className="text-base" />
                <span className="hidden lg:inline ml-3 font-medium">Settings</span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Design Button */}
      <Link
        href={designButtonConfig.href}
        className="hidden lg:flex w-full py-3 px-4 rounded-lg font-medium items-center justify-center mt-6 transition-all duration-200 hover:shadow-md bg-folio-text text-white hover:bg-opacity-90"
      >
        <FaPlus className="mr-2" /> {designButtonConfig.label}
      </Link>
      
      {/* Mobile Design Button */}
      <Link
        href={designButtonConfig.href}
        className="lg:hidden w-12 h-12 rounded-full flex items-center justify-center mt-6 transition-all duration-200 hover:shadow-md bg-folio-text text-white hover:bg-opacity-90"
      >
        <FaPlus />
        <span className="sr-only">{designButtonConfig.label}</span>
      </Link>
    </div>
  );
};

export default Navigation; 