> ⚠️ Canonical Notice  
> This document reflects the current implemented state of the system based on a codebase audit.  
> It does not define future direction unless explicitly stated elsewhere.

# User System

## Purpose

This document describes the user system, authentication, authorization, roles, and user-related data models as implemented in the codebase.

## User Roles

Currently implemented roles in the `Role` enum (from `prisma/schema.prisma`):

- `ADMIN`
- `VENDOR`
- `DESIGNER` (default role)
- `HOMEOWNER`
- `GUEST`
- `INDIVIDUAL`

## User Model

Observed in schema (`prisma/schema.prisma` - User model):

**Core Fields:**
- `id`: String (UUID, primary key)
- `email`: String (unique)
- `name`: String (required)
- `passwordHash`: String (required)
- `role`: Role enum (default: DESIGNER)
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Profile Fields:**
- `bio`: String? (optional)
- `profileImage`: String? (optional)
- `location`: String? (optional)
- `title`: String? (optional)
- `phone`: String? (optional)
- `studio`: String? (optional)
- `specialties`: String[] (array)
- `website`: String? (optional)
- `instagram`: String? (optional)
- `linkedin`: String? (optional)
- `companyName`: String? (optional)

**User-Specific Fields:**
- `budgetRange`: String? (optional)
- `desiredRooms`: String[] (array)
- `serviceLevel`: String? (optional)
- `projectStatus`: String? (optional)
- `followers`: Int (default: 0)
- `followingCount`: Int (default: 0)
- `views`: Int (default: 0)

**Designer-Specific:**
- `onboardingBrandStepCompletedAt`: DateTime? (optional)
- `brandProfile`: DesignerBrandProfile? (relation)

**Designer Attribution Fields:**
- `vendorVisibility`: Boolean (default: false) — Whether vendors can see designer's active specifications
- `vendorVisibilityEnabledAt`: DateTime? (optional) — When visibility was turned on
- `influenceScore`: Float? (optional) — Calculated influence score (0-100)
- `influenceScoreUpdatedAt`: DateTime? (optional) — Last score calculation
- `folioCreditBalance`: Decimal (default: 0) — Current Folio Credit balance in USD

**Vendor Rep Fields:**
- `isVendorRep`: Boolean (default: false)
- `vendorOrganizationId`: String? (optional, relation to Organization)
- `workEmail`: String? (optional)
- `workEmailVerifiedAt`: DateTime? (optional)
- `originalInviteEmail`: String? (optional)

## Authentication

Present in code (`src/app/api/auth/[...nextauth]/options.ts`):

- **Provider**: Credentials-based authentication
- **Password Storage**: bcrypt hashing
- **Session Strategy**: JWT
- **Email Lookup**: Case-insensitive
- **Session Callbacks**: Role hydration from database

**Auth Endpoints Observed:**
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User authentication
- `GET /api/auth/me` - Current user info
- `POST /api/auth/signout` - Sign out

## Organizations

Observed in schema (`prisma/schema.prisma` - Organization model):

**Organization Types (OrgType enum):**
- `VENDOR`
- `DESIGN_FIRM` (default)
- `MANUFACTURER`
- `SHOWROOM`
- `CONTRACTOR`

**OrganizationUser Model:**
- Links users to organizations
- `role`: OrgUserRole enum (OWNER, ADMIN, MANAGER, MEMBER, VIEWER)
- `isActive`: Boolean (default: true)
- Unique constraint on (userId, organizationId)

**OrgUserRole Enum:**
- `OWNER`
- `ADMIN`
- `MANAGER`
- `MEMBER`
- `VIEWER` (default)

## Authorization

**Two-Level System Observed:**

1. **Organization/Account Context (RBAC)**
   - Organization.type determines side (VENDOR vs DESIGN_FIRM)
   - OrgUserRole defines capabilities within organization

2. **Project-Level ACL (Participants)**
   - ProjectParticipant model provides project-level access
   - ParticipantSide: DESIGNER | VENDOR
   - ParticipantRole: OWNER | EDITOR | VIEWER

**Access Control Functions:**
- Present in `src/lib/authz/access.ts`
- Functions include: `getProjectAccess()`, `assertProjectView()`, `createProjectParticipant()`

## User Relations

Observed relationships from User model:

- Projects (designerProjects, ownedProjects)
- Products (products - vendor products)
- Organizations (organizationUsers)
- Events (events, rsvps)
- Folders (folders)
- Posts (posts)
- Stories (stories, vendorStories)
- Quotes (vendorQuotes)
- Selections (vendorSelections)
- ProjectParticipants
- Follow relationships (following, followedBy)
- Atelier fingerprints and signals
- Event-related profiles and edges
- Interview sessions
- Action items (assigned, created)

## Designer Directory Ranking

Designer directory position is calculated from ecosystem participation signals:

| Signal | Weight | Description |
|--------|--------|-------------|
| Post frequency + engagement | High | Published projects and their saves/views |
| On-platform transactions | High | Purchases completed through Folio checkout |
| Profile completeness | Medium | Bio, portfolio, contact info filled |
| Response rate to inquiries | Medium | Speed and rate of responding to messages |
| Vendor Visibility status | Low | Small boost when visibility is ON |
| Influence-to-transaction ratio | Modifier | Adjusts score based on conversion behavior |

Ranking is recalculated daily. See 12_COMPENSATION_SYSTEM.md for full economics.

## Vendor Visibility Setting

Controls what vendors can see about designer's specification activity.

**When OFF (default):**
- Vendors see only aggregate engagement data
- Designer's saves and specs are private
- Designer does not appear in vendor specifier dashboards

**When ON:**
- Vendors can see designer is actively specifying their products
- Designer eligible for appreciation programs and priority support
- Designer appears in vendor "Top Specifiers" analytics
- Small boost to directory ranking

See 13_ATTRIBUTION_CONSENT.md for full consent architecture.

## Related Documents

- 12_COMPENSATION_SYSTEM.md — Tier 1 and Tier 2 compensation structures
- 13_ATTRIBUTION_CONSENT.md — Data visibility tiers and consent requirements

