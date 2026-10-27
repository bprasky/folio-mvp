'use client';

import Link from 'next/link';
import Image from '@/components/FolioImage';
import { User, Building2, MapPin } from 'lucide-react';

export interface SearchUser {
  id: string;
  name: string | null;
  role: string;
  profileImage: string | null;
  location: string | null;
  title: string | null;
  studio: string | null;
}

export interface SearchOrg {
  id: string;
  name: string;
  type: string;
  logo: string | null;
  location: string | null;
  description: string | null;
}

interface PeopleOrgResultsProps {
  users: SearchUser[];
  organizations: SearchOrg[];
}

const roleLabels: Record<string, string> = {
  DESIGNER: 'Designer',
  ARCHITECT: 'Architect',
  BUILDER: 'Builder',
  VENDOR: 'Vendor',
  PHOTOGRAPHER: 'Photographer',
  ADMIN: 'Admin',
  DEVELOPER: 'Developer',
  INDIVIDUAL: 'Member',
  GUEST: 'Guest',
};

const orgTypeLabels: Record<string, string> = {
  VENDOR: 'Vendor',
  DESIGN_FIRM: 'Design Firm',
  MANUFACTURER: 'Manufacturer',
  SHOWROOM: 'Showroom',
  CONTRACTOR: 'Contractor',
  DEVELOPER: 'Developer',
  PHOTOGRAPHY_STUDIO: 'Photography Studio',
};

export default function PeopleOrgResults({ users, organizations }: PeopleOrgResultsProps) {
  if (users.length === 0 && organizations.length === 0) {
    return null;
  }

  return (
    <div className="w-full px-2 sm:px-3 pb-6">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {users.map((user) => (
          <Link
            key={`user-${user.id}`}
            href={`/profile/${user.id}`}
            className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-surface-canvas border border-folio-border-subtle rounded-sm hover:border-neutral-300 transition-colors min-w-[220px] max-w-[300px]"
          >
            {user.profileImage ? (
              <Image
                src={user.profileImage}
                alt={user.name || 'User'}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover border border-folio-border-subtle flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-surface-ground border border-folio-border-subtle flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-folio-text-tertiary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-serif text-sm text-folio-text-primary truncate">
                {user.name || 'Unnamed'}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-folio-text-tertiary">
                <span>{roleLabels[user.role] || user.role}</span>
                {user.location && (
                  <>
                    <span className="text-folio-border-subtle">·</span>
                    <span className="truncate">{user.location}</span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
        {organizations.map((org) => (
          <Link
            key={`org-${org.id}`}
            href={`/org/${org.id}`}
            className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-surface-canvas border border-folio-border-subtle rounded-sm hover:border-neutral-300 transition-colors min-w-[220px] max-w-[300px]"
          >
            {org.logo ? (
              <Image
                src={org.logo}
                alt={org.name}
                width={40}
                height={40}
                className="h-10 w-10 rounded object-cover border border-folio-border-subtle flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded bg-surface-ground border border-folio-border-subtle flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-folio-text-tertiary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-serif text-sm text-folio-text-primary truncate">
                {org.name}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-folio-text-tertiary">
                <span>{orgTypeLabels[org.type] || org.type}</span>
                {org.location && (
                  <>
                    <span className="text-folio-border-subtle">·</span>
                    <span className="truncate">{org.location}</span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
