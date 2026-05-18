// Maps a professional Role to the OrgType that represents that role's firm.
// See 17_ONBOARDING_FLOW Step 2 (Firm Context).
import type { OrgType } from '@prisma/client';

export function orgTypeForRole(role: string): OrgType | null {
  switch (role) {
    case 'DESIGNER':
      return 'DESIGN_FIRM';
    case 'ARCHITECT':
      return 'ARCHITECTURE_FIRM';
    case 'BUILDER':
      return 'CONTRACTOR';
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
