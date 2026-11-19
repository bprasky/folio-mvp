'use client';

import { Check, Minus } from 'lucide-react';
import {
  ORG_ROLES,
  ROLE_LABEL,
  ROLE_TAGLINE,
  CAPABILITY_ORDER,
  CAPABILITY_LABEL,
  can,
} from '@/lib/orgPermissions';

// Renders the org role → capability matrix from src/lib/orgPermissions.ts.
// One source of truth — if the lib changes, this changes. Designed to live
// on /org/[orgId]/settings so admins can explain to themselves what each
// role's seat actually buys.

export function RolePermissionsMatrix({ membersCanPublish = true }: { membersCanPublish?: boolean }) {
  return (
    <section
      className="mb-10 p-5 rounded-2xl border"
      style={{ borderColor: 'var(--folio-border-subtle)', backgroundColor: 'var(--surface-canvas)' }}
      aria-label="Roles and permissions"
    >
      <div className="mb-4">
        <h2
          className="text-lg italic mb-1"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--folio-text-primary)', fontWeight: 'var(--w-body)' }}
        >
          Roles &amp; permissions
        </h2>
        <p className="text-xs" style={{ color: 'var(--folio-text-secondary)' }}>
          What each role can do in your firm. Member posting follows your setting above.
        </p>
      </div>

      {/* Role one-liners */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {ORG_ROLES.map((r) => (
          <div
            key={r}
            className="p-3 rounded-xl"
            style={{ backgroundColor: 'var(--surface-ground)' }}
          >
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--folio-text-primary)' }}>
              {ROLE_LABEL[r]}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--folio-text-secondary)' }}>
              {ROLE_TAGLINE[r]}
            </p>
          </div>
        ))}
      </div>

      {/* Capability × role matrix */}
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th
                className="text-left py-2 pr-4 font-medium sticky left-0"
                style={{ color: 'var(--folio-text-secondary)', backgroundColor: 'var(--surface-canvas)' }}
              >
                Capability
              </th>
              {ORG_ROLES.map((r) => (
                <th
                  key={r}
                  className="text-center py-2 px-3 font-medium"
                  style={{ color: 'var(--folio-text-secondary)' }}
                >
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITY_ORDER.map((cap, idx) => (
              <tr
                key={cap}
                style={{
                  backgroundColor: idx % 2 === 0 ? 'var(--surface-ground)' : 'var(--surface-canvas)',
                }}
              >
                <td
                  className="py-2 pr-4 sticky left-0"
                  style={{
                    color: 'var(--folio-text-primary)',
                    backgroundColor: idx % 2 === 0 ? 'var(--surface-ground)' : 'var(--surface-canvas)',
                  }}
                >
                  {CAPABILITY_LABEL[cap]}
                </td>
                {ORG_ROLES.map((r) => (
                  <td key={r} className="py-2 px-3 text-center">
                    {can(r, cap, { membersCanPublish }) ? (
                      <Check
                        className="inline-block w-3.5 h-3.5"
                        style={{ color: 'var(--folio-text-primary)' }}
                        aria-label="Yes"
                      />
                    ) : (
                      <Minus
                        className="inline-block w-3.5 h-3.5"
                        style={{ color: 'var(--folio-border-strong)' }}
                        aria-label="No"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-4" style={{ color: 'var(--folio-text-secondary)' }}>
        Members can only be invited at roles below the inviter&rsquo;s own.
        Owner is unique — exactly one per organization; transfer ownership
        from the Members section to change it.
      </p>
    </section>
  );
}
