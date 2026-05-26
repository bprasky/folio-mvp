// Maps a professional Role to the OrgType that represents that role's firm.
// See 17_ONBOARDING_FLOW Step 2 (Firm Context).
import type { OrgType, Role } from '@prisma/client';

export function orgTypeForRole(role: string): OrgType | null {
  switch (role) {
    case 'DESIGNER':
      return 'DESIGN_FIRM';
    case 'ARCHITECT':
      return 'ARCHITECTURE_FIRM';
    case 'BUILDER':
      return 'CONTRACTOR';
    case 'VENDOR':
      return 'VENDOR';
    case 'PHOTOGRAPHER':
      return 'PHOTOGRAPHY_STUDIO';
    case 'DEVELOPER':
      return 'DEVELOPER';
    default:
      return null;
  }
}

// Reverse direction: given an OrgType, what Role does membership imply?
// Used by /auth/org-setup endpoints (create / claim / approval) to auto-
// promote INDIVIDUAL users into the matching pro role on join/create.
// See docs/AUTH_ORG_ENROLLMENT_FLOW.md.
export function roleForOrgType(type: OrgType): Role | null {
  switch (type) {
    case 'DESIGN_FIRM':
      return 'DESIGNER';
    case 'ARCHITECTURE_FIRM':
      return 'ARCHITECT';
    case 'CONTRACTOR':
      return 'BUILDER';
    case 'VENDOR':
    case 'MANUFACTURER':
    case 'SHOWROOM':
      return 'VENDOR';
    case 'PHOTOGRAPHY_STUDIO':
      return 'PHOTOGRAPHER';
    case 'DEVELOPER':
      return 'DEVELOPER';
    default:
      return null;
  }
}

// Adjacent OrgTypes shown as soft suggestions in firm search results
// (e.g., a Designer searching for their studio finds an ARCHITECTURE_FIRM
// match — UI prompts "Join as Architect?" rather than silently cross-matching).
export function adjacentOrgTypesForRole(role: string): OrgType[] {
  switch (role) {
    case 'DESIGNER':
      return ['ARCHITECTURE_FIRM'];
    case 'ARCHITECT':
      return ['DESIGN_FIRM'];
    case 'BUILDER':
      return [];
    default:
      return [];
  }
}
