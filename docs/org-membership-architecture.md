# Organization Membership Architecture

## Overview

Folio uses an **individual-first, org-membership-based** permission system. User types and capabilities are derived from organization memberships, not from a global `User.role` field.

## Core Principles

1. **Everyone signs up as INDIVIDUAL** - `User.role` stays as `INDIVIDUAL` for all users
2. **Permissions derive from org membership** - Not from the global role field
3. **Multi-org support** - Users can belong to multiple orgs of different types
4. **Example**: Someone can be a designer at one firm AND a vendor at their own brand

## Role Types

### User.role (Legacy - DO NOT USE for permissions)
- Always set to `INDIVIDUAL` for new signups
- Only legacy `DESIGNER` accounts from phase 1 may have different values
- **Do not update** when users create/join orgs
- **Do not check** for permission logic

### OrgUserRole (OrganizationUser.role)
Administrative permissions **within** an organization:

- **OWNER** - Full control (settings, verify/claim, billing, delete org)
  - Only assigned when someone **claims** the org
  - One owner per org

- **ADMIN** - Manage org (invite members, manage projects, manage members except OWNER)
  - Assigned to creator of **unclaimed** org
  - Can be promoted from MEMBER

- **MEMBER** - Standard access (own projects only)
  - Default role when joining via invite
  - Can be promoted by ADMIN/OWNER

- **MANAGER** - Project oversight (manage team projects)
  - Optional role between ADMIN and MEMBER

- **VIEWER** - Read-only access
  - Can view but not modify

## Organization Lifecycle

### 1. Create Organization
```typescript
// User creates a new org (unclaimed)
POST /api/organizations
{
  name: "Acme Design Studio",
  type: "DESIGN_FIRM",
  userId: "user123"
}

// Result:
// - Organization created
// - Creator assigned role: ADMIN (not OWNER!)
// - Org is unclaimed until verified
```

### 2. Claim Organization
```typescript
// User proves they own/represent the org
POST /api/organizations/:id/claim
{
  verificationMethod: "domain" | "documents",
  proof: { ... }
}

// Result:
// - Claimer's role upgraded: ADMIN → OWNER
// - Org marked as verified/claimed
```

### 3. Invite Members
```typescript
// ADMIN or OWNER invites new member
POST /api/organizations/:id/invites
{
  email: "designer@example.com",
  role: "MEMBER" // Default
}

// Result:
// - Invitation sent
// - When accepted, user gets MEMBER role
```

## Deriving User Type

Use helper functions to determine user capabilities based on org memberships:

```typescript
import {
  isDesigner,
  isVendor,
  getPrimaryUserType
} from '@/lib/orgMembership';
import { getActiveMemberships } from '@/lib/server/getUserMemberships';

// Get user's memberships
const memberships = await getActiveMemberships(userId);

// Check capabilities
const canDesign = isDesigner(memberships); // Has DESIGN_FIRM membership
const canSell = isVendor(memberships);     // Has VENDOR membership

// Get primary type for display
const userType = getPrimaryUserType(memberships);
// Returns: 'DESIGN_FIRM' | 'VENDOR' | 'MANUFACTURER' | 'INDIVIDUAL'
```

## Permission Checking Patterns

### ❌ **OLD WAY (Don't do this)**
```typescript
// Checking User.role globally
if (user.role === 'DESIGNER') {
  // Allow designer features
}
```

### ✅ **NEW WAY (Do this)**
```typescript
// Check org memberships
const memberships = await getActiveMemberships(user.id);

if (isDesigner(memberships)) {
  // Allow designer features
}

// Or for specific org:
const role = await getUserOrgRole(user.id, orgId);
if (role === 'ADMIN' || role === 'OWNER') {
  // Allow org management
}
```

## Multi-Org Example

A user can have multiple roles simultaneously:

```typescript
const user = {
  id: "user123",
  role: "INDIVIDUAL", // Global role (always INDIVIDUAL)
  memberships: [
    {
      organization: { type: "DESIGN_FIRM", name: "Studio A" },
      role: "MEMBER"
    },
    {
      organization: { type: "VENDOR", name: "My Product Line" },
      role: "OWNER"
    }
  ]
};

// This user:
isDesigner(user.memberships);  // true
isVendor(user.memberships);    // true
getPrimaryUserType(user.memberships); // "DESIGN_FIRM" (priority order)
getUserTypeLabel(user.memberships);   // "Designer"
```

## Navigation & UI Display

Show capabilities based on **all** org memberships:

```typescript
const memberships = await getActiveMemberships(userId);

const navItems = [];

// Designer features
if (isDesigner(memberships)) {
  navItems.push({ label: "Projects", href: "/projects" });
  navItems.push({ label: "Clients", href: "/clients" });
}

// Vendor features
if (isVendor(memberships)) {
  navItems.push({ label: "Products", href: "/products" });
  navItems.push({ label: "Analytics", href: "/analytics" });
}

// Always available
navItems.push({ label: "Discover", href: "/magazine" });
```

## Migration Notes

### Existing Code
- Legacy `User.role` checks should be **gradually migrated** to org membership checks
- Files with role checks: ~50+ locations identified in audit
- Priority: High-traffic routes first, then UI components

### Backwards Compatibility
- Phase 1 DESIGNER accounts still flow through approval
- Existing `User.role === 'DESIGNER'` checks work but should be migrated
- Middleware preserves PENDING/REJECTED checks for legacy designers

## API Patterns

### Creating Org-Scoped Resources
```typescript
// When creating a project under an org
POST /api/organizations/:orgId/projects
{
  title: "Client Project",
  // ... project data
}

// Verify membership and role
const role = await getUserOrgRole(userId, orgId);
if (!role || !['ADMIN', 'OWNER', 'MEMBER'].includes(role)) {
  return res.status(403).json({ error: 'Not a member' });
}

// Create project associated with org
const project = await prisma.project.create({
  data: {
    ownerId: userId,
    designerOrgId: orgId, // or vendorOrgId
    // ...
  }
});
```

## File Reference

**Helper Functions:**
- `/src/lib/orgMembership.ts` - Client/server utilities for deriving user type
- `/src/lib/server/getUserMemberships.ts` - Server-side membership fetching

**API Routes:**
- `/src/app/api/organizations/route.ts` - Org creation (assigns ADMIN)
- `/src/app/api/organizations/[id]/claim/route.ts` - Claim flow (assigns OWNER) [TODO]
- `/src/app/api/organizations/[id]/invites/route.ts` - Invite flow (assigns MEMBER) [TODO]

**Schema:**
- `User.role` - Always INDIVIDUAL (legacy field)
- `OrganizationUser.role` - OWNER | ADMIN | MANAGER | MEMBER | VIEWER
- `Organization.type` - DESIGN_FIRM | VENDOR | MANUFACTURER | SHOWROOM | CONTRACTOR
