import { normalizeRole } from '@/lib/permissions';

export type NavLink = { href: string; label: string };

/**
 * Individual-First Architecture - Role Navigation Mapping
 *
 * Individual (base user type):
 *  - Discover          -> /discover  (browse designers, projects)
 *  - Events            -> /events
 *  - Boards            -> /boards    (personal inspiration boards)
 *
 * Vendor:
 *  - Events (landing)  -> /events
 *  - Products          -> /vendor/products
 *  - Dashboard         -> /vendor/dashboard
 *
 * Designer:
 *  - Events (landing)  -> /events
 *  - Projects          -> /projects
 *
 * Admin:
 *  - Discover          -> /discover
 *  - Editorial         -> /editorials
 *  - Events            -> /events
 *  - Projects          -> /projects
 */
export function navItemsForRole(rawRole?: string): NavLink[] {
  const role = normalizeRole(rawRole);

  if (role === 'VENDOR') {
    return [
      { href: '/events', label: 'Events' },
      { href: '/vendor/products', label: 'Products' },
      { href: '/vendor/dashboard', label: 'Dashboard' },
    ];
  }

  if (role === 'DESIGNER') {
    return [
      { href: '/events', label: 'Events' },
      { href: '/projects', label: 'Projects' },
    ];
  }

  if (role === 'ADMIN') {
    return [
      { href: '/discover', label: 'Discover' },
      { href: '/editorials', label: 'Editorial' },
      { href: '/events', label: 'Events' },
      { href: '/projects', label: 'Projects' },
    ];
  }

  // Individual (and deprecated HOMEOWNER): browse-focused navigation
  if (role === 'INDIVIDUAL' || role === 'HOMEOWNER') {
    return [
      { href: '/discover', label: 'Discover' },
      { href: '/events', label: 'Events' },
      { href: '/boards', label: 'Boards' },
    ];
  }

  // Fallback for guests: minimal navigation
  return [
    { href: '/discover', label: 'Discover' },
    { href: '/events', label: 'Events' },
  ];
}

