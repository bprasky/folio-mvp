import { normalizeRole } from '@/lib/permissions';

export type NavLink = { href: string; label: string };

/**
 * Phase 1 role navigation mapping
 *
 * Vendor:
 *  - Events (landing)  -> /events
 *  - Products          -> /vendor/products
 *  - Dashboard         -> /vendor/dashboard   (unified dashboard with Events & Projects tabs)
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

  // Fallback for other roles (Homeowner/Student): keep it minimal or mirror Designer's top-levels
  return [
    { href: '/events', label: 'Events' },
  ];
}

