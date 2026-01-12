# Individual-First User Architecture

## Overview

This document describes the Individual-First Architecture implemented for Folio, where all new users sign up as "individuals" with a base set of capabilities, and additional functionality is unlocked through organization membership.

## Architecture Principles

### Individual = Base User
Everyone signs up as an individual. No type selection at account creation.

**Individual capabilities:**
- Create and manage personal boards
- Save products/projects from tags
- Browse and follow designers/orgs
- Toggle board visibility on profile

**Individual restrictions:**
- Cannot upload projects (requires org membership)
- Cannot access designer tools (meeting notes, selections, etc.)
- No org-level features until org membership exists

### Organization = Production Unit
Org membership unlocks capabilities, not user type.

- Designer/vendor functionality lives at the org level
- Users can belong to multiple orgs
- Org module appears on individual profile (toggleable)
- Billing gates live at org level (free tier vs paid tier)

## Implementation Details

### Database Schema Changes

**File:** `prisma/schema.prisma`

The `Role` enum now includes:
```prisma
enum Role {
  ADMIN
  VENDOR
  DESIGNER
  INDIVIDUAL  // Base user type - all new signups start here
  GUEST
}
```

The default role for new users is now `INDIVIDUAL`:
```prisma
model User {
  role Role @default(INDIVIDUAL)
  // ...
}
```

**Migrations:**
- `20251205125155_add_individual_role` - Added INDIVIDUAL to Role enum
- `20250101000000_remove_homeowner_enum` - Migrated HOMEOWNER users to INDIVIDUAL

### Signup Flow Changes

**Files Modified:**
- `src/app/auth/signup/page.tsx` - Simplified signup form
- `src/app/api/auth/signup/route.ts` - Creates INDIVIDUAL users

**Before:**
- Users selected a role (Designer, Vendor, Individual)
- Designers proceeded to account creation
- Vendors/Individuals went to waitlist

**After:**
- Single form: name, email, password
- All users created as INDIVIDUAL
- Account status is APPROVED (no admin approval needed)
- Users can browse immediately after signup

### Permission System Updates

**File:** `src/lib/permissions.ts`

New permission functions added:
```typescript
// Check if user can create boards (all authenticated users)
canCreateBoard(role?: string): boolean

// Check if user can browse and save products
canBrowseAndSave(role?: string): boolean

// Check if user can follow designers/orgs
canFollow(role?: string): boolean

// Check if user can access designer tools
canAccessDesignerTools(role?: string): boolean

// Check if user is an individual (base user type)
isIndividual(role?: string): boolean
```

Updated permission functions:
- `canCreateProject()` - Only DESIGNER, VENDOR, ADMIN can create projects
- `getCreateTarget()` - Returns appropriate create action based on role

### Navigation Updates

**File:** `src/lib/navItems.ts`

Individual users see:
- Discover - Browse designers and projects
- Events - View events
- Boards - Personal inspiration boards

### Context and UI Updates

**Files Modified:**
- `src/contexts/RoleContext.tsx` - Added 'individual' type, migrates 'homeowner'
- `src/components/RoleSelector.tsx` - Updated to use 'individual' as primary
- `src/app/api/profiles/route.ts` - Accepts 'individual' parameter
- `src/app/admin/users/page.tsx` - Shows INDIVIDUAL role color

## User Type Mapping

| Old Type | New Type | Notes |
|----------|----------|-------|
| HOMEOWNER | INDIVIDUAL | Deprecated, migrated to INDIVIDUAL |
| DESIGNER | DESIGNER | Unchanged (requires org membership for new users in Phase 2) |
| VENDOR | VENDOR | Unchanged (requires org membership for new users in Phase 2) |
| ADMIN | ADMIN | Unchanged |
| GUEST | GUEST | Unchanged (unauthenticated users) |

## Backwards Compatibility

For backwards compatibility:
- Code still accepts 'homeowner' as input and maps it to INDIVIDUAL
- RoleContext migrates localStorage 'homeowner' to 'individual'
- API routes accept both 'individual' and 'homeowner' parameters

## Phase 2 Considerations

Future work for Phase 2:
1. **Org Invitation System** - Allow individuals to be invited to orgs
2. **Org Creation Flow** - Allow individuals to create their own orgs
3. **Role Derivation** - User's effective role derived from org membership
4. **Org-Level Permissions** - Feature access tied to org membership, not user type

## Files Modified

### Core Files
- `prisma/schema.prisma` - Role enum and default
- `src/app/auth/signup/page.tsx` - Signup flow
- `src/app/api/auth/signup/route.ts` - Signup API
- `src/lib/permissions.ts` - Permission functions
- `src/lib/navItems.ts` - Navigation items

### Supporting Files
- `src/contexts/RoleContext.tsx` - Client-side role context
- `src/components/RoleSelector.tsx` - Role selector component
- `src/app/api/profiles/route.ts` - Profiles API
- `src/app/admin/users/page.tsx` - Admin users page

## Testing Checklist

- [ ] New user can sign up without selecting a role
- [ ] New user is created as INDIVIDUAL with APPROVED status
- [ ] New user can browse, save, and follow immediately
- [ ] New user cannot create projects
- [ ] New user cannot access designer tools (/designer/* routes)
- [ ] Existing HOMEOWNER users are treated as INDIVIDUAL
- [ ] Admin can see INDIVIDUAL users in admin panel
- [ ] Demo role switcher includes INDIVIDUAL option
