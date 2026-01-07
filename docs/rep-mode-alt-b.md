# Rep Mode – Alt B Implementation

## Overview

Rep Mode – Alt B enables vendor representatives to automatically follow designers who tag their organization, receive notifications about tagged projects, and access a dedicated dashboard feed. The system handles personal vs professional email routing and supports zero-destructive changes to existing workflows.

## New Models and Fields

### PendingRepInvite Model

Tracks invitations sent to potential vendor reps when designers tag products from their organization.

**Fields:**
- `id`: Unique identifier (cuid)
- `email`: Email address that received the invite (may be personal)
- `vendorOrganizationId`: Link to vendor organization (optional)
- `designerId`: Designer who triggered the invite
- `projectId`: Project where tagging occurred
- `projectTagId`: Specific product tag that triggered invite (optional)
- `status`: PENDING | CLAIMED | CANCELLED
- `token`: Secure token for onboarding link
- `repUserId`: User who claimed the invite (set after onboarding)

### Follow Model

Tracks follow relationships between users (reps following designers).

**Fields:**
- `id`: Unique identifier (cuid)
- `followerId`: User who is following
- `followingId`: User being followed
- `createdAt`: When the follow was created

**Constraints:**
- Unique constraint on `[followerId, followingId]` to prevent duplicates

### User Model Extensions

Added rep-specific fields to the existing User model:

- `isVendorRep`: Boolean flag indicating this user acts as a vendor rep
- `vendorOrganizationId`: Link to vendor organization
- `workEmail`: Professional email for notifications (optional)
- `workEmailVerifiedAt`: Timestamp when work email was verified
- `originalInviteEmail`: Email that first received the invite (for audit/tracking)

**Relations:**
- `pendingRepInvites`: Invites claimed by this rep
- `designerPendingRepInvites`: Invites created by this designer
- `following`: Users this rep is following
- `followedBy`: Users following this rep

### Organization Model Extensions

Added relations:
- `vendorReps`: Users who are reps for this organization
- `pendingRepInvites`: Pending invites for this organization

## New Endpoints

### Rep Onboarding

**GET `/auth/rep-onboarding`**
- Validates invite token and displays email choice screen
- Redirects to signin/signup if user not authenticated

**GET `/api/auth/rep-onboarding/validate`**
- Validates invite ID and token
- Returns invite data if valid

**POST `/api/auth/rep-onboarding/complete`**
- Completes rep onboarding
- Updates user with rep fields
- Reassigns all pending invites for the email
- Triggers auto-follow logic

### Rep Dashboard

**GET `/api/vendor/rep/dashboard`**
- Requires authenticated vendor rep user
- Returns feed of projects where vendor org was tagged
- Returns list of designers being followed
- Includes project summaries and product counts

**GET `/vendor/rep/dashboard`**
- Frontend dashboard page
- Displays feed of tagged projects
- Shows sidebar with followed designers

### Tagging API Updates

**POST `/api/tag-product-to-image`**
- Now accepts optional `repEmail` parameter
- If rep email provided:
  - Checks if user exists and is a rep → creates follow relationship
  - If user doesn't exist → creates PendingRepInvite
  - TODO: Sends email with onboarding link

## Rep Onboarding Flow

1. **Designer tags product** → System creates PendingRepInvite if rep email provided
2. **Rep receives email** → Contains link to `/auth/rep-onboarding?inviteId=...&token=...`
3. **Rep clicks link**:
   - If not logged in → Redirected to signin/signup
   - If logged in → Shown email choice screen
4. **Email choice screen**:
   - Option A: Use invite email as work email
   - Option B: Provide different professional email
5. **On completion**:
   - User marked as `isVendorRep = true`
   - `workEmail` set (either invite email or provided email)
   - All pending invites for that email marked as CLAIMED
   - Auto-follow logic executed

## Auto-Follow Behavior

When a rep completes onboarding:

1. System finds all designers who have tagged the rep's vendor organization via:
   - PendingRepInvite records
   - ProductTag records (products from vendor org users)
   - Projects directly linked to vendor org

2. Creates Follow relationships for each designer found

3. Ensures no duplicate follows (uses upsert)

**Function:** `autoFollowDesignersForRep(userId: string)` in `src/lib/server/repAutoFollow.ts`

## Rep Mode Dashboard Feed

The dashboard automatically populates with:

- **Projects** where the vendor organization was tagged
- **Designers** who tagged the organization
- **Product counts** per project
- **Activity summaries** (e.g., "Designer X tagged 3 of your products in Project Y")

Feed is ordered by most recent activity first.

## Email Routing Logic

All rep-related notifications use the `getPreferredRepEmail()` helper:

- If `workEmail` is set and `workEmailVerifiedAt` is set → use `workEmail`
- Otherwise → use `email` (login email)

This ensures that once a rep switches from personal to professional email, all future notifications go to the work email.

**Function:** `getPreferredRepEmail(user: User)` in `src/lib/server/repUtils.ts`

## Designer Awareness

In the product tagging UI (`AdvancedTagProducts` component), a subtle note appears:

> **Note:** When vendor reps create a Folio profile, they'll automatically follow you and see this project in their Rep dashboard. This helps them support specs and stay aligned with your work.

This microcopy is non-blocking and appears in the product selection modal.

## Backwards Compatibility

All changes are additive:

- ✅ No existing tables/columns renamed or deleted
- ✅ Existing onboarding, tagging, and vendor flows continue to work
- ✅ Existing data remains valid
- ✅ All new fields are optional
- ✅ Follow system is independent and doesn't affect existing user relationships

## Implementation Files

### Schema
- `prisma/schema.prisma` - Added models and fields

### Utilities
- `src/lib/server/repUtils.ts` - Token generation and email routing
- `src/lib/server/repAutoFollow.ts` - Auto-follow logic

### API Routes
- `src/app/api/tag-product-to-image/route.ts` - Updated to handle rep email
- `src/app/api/auth/rep-onboarding/validate/route.ts` - Invite validation
- `src/app/api/auth/rep-onboarding/complete/route.ts` - Onboarding completion
- `src/app/api/vendor/rep/dashboard/route.ts` - Dashboard feed API

### Frontend
- `src/app/auth/rep-onboarding/page.tsx` - Onboarding UI
- `src/app/vendor/rep/dashboard/page.tsx` - Dashboard UI
- `src/components/AdvancedTagProducts.tsx` - Added microcopy

## Migration

Run the migration with:
```bash
npx prisma migrate dev --name rep_mode_alt_b
npx prisma generate
```

## Future Enhancements

- [ ] Email sending for rep invites (currently TODO in code)
- [ ] Email verification flow for work emails
- [ ] Notification system integration
- [ ] Dashboard filters (by designer, by date, by event type)
- [ ] Rep email field in tagging UI (currently API-only)




