# Changelog - January 30, 2025

## Summary
Major implementation of Admin Pending Vendor Invites system with multi-contact support. This system captures vendor information when designers tag products, without sending emails, and provides an admin dashboard for managing pending vendor onboarding.

---

## 🎯 Feature: Admin Pending Vendor Invites (Initial Implementation)

### Database Schema Changes

#### New Models Added

**VendorInviteCandidate** (`vendor_invite_candidates` table)
- Stores unique vendor invite candidates with deduplication
- Fields:
  - `id`, `createdAt`, `updatedAt`
  - `vendorName` (required)
  - `vendorWebsite` (optional)
  - `repEmail`, `repName` (deprecated - kept for migration compatibility)
  - `status` (enum: PENDING, READY, INVITED, ARCHIVED)
  - `normalizedKey` (unique, for deduplication)
  - `firstSeenByDesignerId`, `firstSeenInProjectId` (provenance tracking)
  - `primaryDomain`, `lastSeenAt` (added in Phase 2)
- Relations: signals, contacts, firstSeenByDesigner, firstSeenInProject

**VendorInviteSignal** (`vendor_invite_signals` table)
- Tracks each instance of a designer tagging a vendor
- Fields:
  - `id`, `createdAt`
  - `candidateId` (FK)
  - `designerId`, `projectId` (provenance)
  - `tagId` (optional - ProductTag or Selection ID)
- One-to-many relationship with VendorInviteCandidate

**VendorInviteContact** (`vendor_invite_contacts` table) - Added in Phase 2
- Stores individual contact emails (prevents overwrites)
- Fields:
  - `id`, `createdAt`
  - `candidateId` (FK)
  - `email` (required, lowercase)
  - `name`, `title` (optional)
  - `domain` (extracted from email)
  - `designerId`, `projectId`, `tagId` (provenance)
  - `source` (TAGGING | SCRAPE | MANUAL_ADMIN | LEGACY)
  - `sourceUrl` (optional)
- Unique constraint: `(candidateId, email)` prevents duplicate contacts
- One-to-many relationship with VendorInviteCandidate

#### New Enum
- `VendorInviteCandidateStatus`: PENDING, READY, INVITED, ARCHIVED

#### Migration Files Created
1. `prisma/migrations/add_vendor_invite_candidates.sql` - Initial schema
2. `prisma/migrations/mark_vendor_invite_candidates_migration_complete.sql` - Migration marker
3. `prisma/migrations/add_vendor_invite_contacts.sql` - Multi-contact support
4. `prisma/migrations/mark_vendor_invite_contacts_migration_complete.sql` - Migration marker

---

## 📁 New Files Created

### Core Logic
- **`src/lib/vendor/inviteCandidates.ts`**
  - `normalizeVendorName()` - Normalizes vendor names for deduplication
  - `computeNormalizedKey()` - Creates unique deduplication key
  - `captureVendorInviteData()` - Unified capture function (replaces deprecated `captureVendorInviteCandidate()`)
  - Domain extraction utilities
  - **Key Feature**: No overwrites - contacts stored as separate rows

### API Routes
- **`src/app/api/admin/pending-invites/route.ts`**
  - `GET` - Returns candidates with aggregates (designer count, project count, signal count, contact count, unique domains)
  - `PATCH` - Updates candidate status
  - Includes full contact and signal history

### Admin UI
- **`src/app/admin/pending-invites/page.tsx`**
  - Full admin dashboard for pending vendor invites
  - Table view with sorting and filtering
  - Detail drawer with contact grouping by domain
  - Blitz pack generation for outreach

### Documentation
- **`docs/vendor-invite-audit.md`**
  - Audit report of all tagging entry points
  - Identification of PRIMARY vs SECONDARY paths
  - Overwrite risk analysis

---

## 🔧 Modified Files

### Schema
- **`prisma/schema.prisma`**
  - Added VendorInviteCandidate model
  - Added VendorInviteSignal model
  - Added VendorInviteContact model (Phase 2)
  - Added VendorInviteCandidateStatus enum
  - Added relations to User and Project models

### Tagging API (PRIMARY PATH)
- **`src/app/api/tag-product-to-image/route.ts`**
  - Added import: `captureVendorInviteData`
  - Added capture hook after vendor resolution
  - Captures vendor info when vendor doesn't exist but vendorName is available
  - Extracts website from product URL
  - Non-blocking error handling

### Selection API (SECONDARY PATH)
- **`src/app/api/selections/route.ts`**
  - Added session authentication
  - Added vendor resolution logic
  - Added capture hook for vendor invite candidates
  - Handles vendorName from selection creation

### Admin Dashboard
- **`src/app/admin/page.tsx`**
  - Added "Pending Vendor Invites" quick action card
  - Links to `/admin/pending-invites`

---

## 🎨 UI/UX Features

### Admin Dashboard Features
1. **Table View**
   - Vendor name and website
   - Contacts count (with domain count if multiple)
   - Designer count (with multi-designer indicator ★)
   - Project count
   - Tag count
   - First seen date
   - Status badge

2. **Filters**
   - Status filter (PENDING, READY, INVITED, ARCHIVED)
   - Sort options (Most Signals, Newest, Oldest)
   - Multi-designer only toggle
   - Has contacts only toggle

3. **Detail Drawer**
   - Full vendor information
   - Contacts grouped by domain
   - Signal history (designer, project, date)
   - Aggregates summary
   - Actions: Mark Ready, Archive, Copy Blitz Pack

4. **Blitz Pack**
   - Generates comprehensive outreach snippet
   - Includes all metrics
   - Contacts grouped by domain
   - Ready-to-use email template

---

## 🔒 Key Design Decisions

### No Overwrites
- Contacts stored as separate rows in `VendorInviteContact` table
- Unique constraint `(candidateId, email)` prevents duplicates
- Multiple designers can add multiple rep emails without losing data

### Deduplication Strategy
- Vendor candidates deduplicated by `normalizedKey` (normalized vendor name)
- Normalization: lowercase, trim, remove business suffixes (Inc., LLC, etc.)
- Optionally includes email domain in key for better matching

### Provenance Tracking
- Every signal tracks: designer, project, tagId
- Every contact tracks: designer, project, tagId, source
- Enables full audit trail of where vendor info came from

### Non-Blocking
- Capture errors don't fail the tagging/selection creation
- Errors logged to console for debugging
- System continues to function even if invite capture fails

### Org-Ready Structure
- Schema designed to map cleanly to Organization/OrgContact models later
- Domain extraction supports future org matching
- No vendor onboarding required today

---

## 📊 Data Flow

### Capture Flow
1. Designer tags product with vendor info
2. System resolves vendor (checks if exists)
3. If vendor doesn't exist:
   - Upsert VendorInviteCandidate by normalizedKey
   - Create VendorInviteSignal for provenance
   - If repEmail provided: Upsert VendorInviteContact
   - Extract and store domains
   - Update lastSeenAt

### Admin View Flow
1. Admin visits `/admin/pending-invites`
2. API fetches candidates with:
   - Aggregates (designer count, project count, signal count, contact count)
   - Full signal history
   - Full contact list (grouped by domain)
3. UI displays table with filters
4. Admin can view details, change status, copy blitz pack

---

## 🧪 Testing Considerations

### What to Test
1. **Multiple Contacts**: Tag same vendor with different rep emails - verify all are stored
2. **Deduplication**: Tag same vendor multiple times - verify single candidate
3. **Provenance**: Verify signals and contacts track correct designer/project
4. **Admin Dashboard**: Verify aggregates are correct
5. **Filters**: Test multi-designer and has-contacts filters
6. **Blitz Pack**: Verify contact grouping by domain

### Edge Cases Handled
- Invalid URLs (try/catch around URL parsing)
- Missing vendor names (skip capture)
- Missing designer IDs (skip capture)
- Duplicate contacts (upsert prevents duplicates)
- Legacy data (migration script handles existing repEmail/repName)

---

## 📝 Migration Notes

### Initial Migration
- Creates `vendor_invite_candidates` table
- Creates `vendor_invite_signals` table
- Creates enum `VendorInviteCandidateStatus`
- Adds foreign keys and indexes

### Contacts Migration
- Creates `vendor_invite_contacts` table
- Adds `primaryDomain` and `lastSeenAt` to candidates
- Migrates existing `repEmail`/`repName` to contacts (source: LEGACY)
- Adds unique constraint on `(candidateId, email)`

### Running Migrations
1. Run `add_vendor_invite_candidates.sql`
2. Run `mark_vendor_invite_candidates_migration_complete.sql`
3. Run `add_vendor_invite_contacts.sql`
4. Run `mark_vendor_invite_contacts_migration_complete.sql`

---

## 🚀 Deployment Checklist

- [ ] Run database migrations
- [ ] Verify Prisma client is regenerated
- [ ] Test tagging flow with vendor info
- [ ] Test selection creation with vendor info
- [ ] Verify admin dashboard loads correctly
- [ ] Test filters and sorting
- [ ] Test blitz pack generation
- [ ] Verify no overwrites occur with multiple contacts

---

## 🔮 Future Enhancements (Not Implemented)

- Bulk actions (mark multiple as ready)
- Export to CSV
- Search/filter by vendor name
- Notes/comments field for admin use
- Track when invites are actually sent (if email is added later)
- Map to Organization/OrgContact models when vendor onboarding is implemented

---

## 📚 Related Documentation

- `docs/vendor-invite-audit.md` - Full audit of tagging paths
- `prisma/migrations/add_vendor_invite_candidates.sql` - Initial migration
- `prisma/migrations/add_vendor_invite_contacts.sql` - Contacts migration

---

## ⚠️ Breaking Changes

None - This is a new feature addition. Existing functionality remains unchanged.

---

## 🐛 Known Issues

None identified at this time.

---

## 👥 Contributors

- AI Assistant (Auto)
- User requirements and specifications

---

*Generated: January 30, 2025*








