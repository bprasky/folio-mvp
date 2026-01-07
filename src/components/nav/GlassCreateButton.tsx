'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useSession } from 'next-auth/react';
import { normalizeRole } from '@/lib/permissions';

/**
 * Role-aware Create button for the Glass Landing Rail.
 *
 * Vendor:
 *  - Create Project (/projects/new)  [reuses existing flow if present]
 *  - Create Product (/vendor/products/new)
 *  - Create Event (/events/new)            (NOT festivals)
 *
 * Designer:
 *  - Create Project (routes to your project chooser or /projects/new)
 *  - Create Concept/Schematic/etc. — if your chooser exists, we just route to it
 *
 * Admin:
 *  - Create Event (/events/new)
 *  - Create Festival (/festivals/new)
 */
export default function GlassCreateButton() {
  const { data: session } = useSession();
  const role = normalizeRole(session?.user?.role);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const actions =
    role === 'VENDOR'
      ? [
          { label: 'Project', href: '/projects/new' },
          { label: 'Product', href: '/vendor/products/new' },
          { label: 'Event', href: '/events/new' },
        ]
      : role === 'DESIGNER'
      ? [
          // If you use a modal chooser, you can dispatch it here instead of routing
          { label: 'Project', href: '/projects/new' },
          { label: 'Client Project', href: '/projects/new?type=client' },
        ]
      : role === 'ADMIN'
      ? [
          { label: 'Event', href: '/events/new' },
          { label: 'Festival', href: '/festivals/new' },
        ]
      : [];

  if (actions.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'rounded-xl px-3 py-1.5 text-sm font-medium',
          'bg-neutral-900 text-white hover:bg-neutral-800',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        + Create
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Create items"
          className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-black/5 bg-white/90 backdrop-blur-md shadow-lg"
        >
          {actions.map((a, i) => (
            <button
              key={a.label + i}
              onClick={() => {
                setOpen(false);
                router.push(a.href);
              }}
              role="menuitem"
              className={clsx(
                'block w-full px-4 py-2 text-left text-sm text-neutral-900 hover:bg-black/5'
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}




