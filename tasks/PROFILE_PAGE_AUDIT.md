# Profile Page Audit — Complete Findings

## Task: Audit existing profile page spec, design, and implementation

**Date**: 2026-02-27
**Status**: Research complete

---

## 1. EXISTING DOCUMENTATION & SPECS

### Spec Documents Found
| Document | Location | What It Covers |
|----------|----------|----------------|
| User System | `docs/04_USER_SYSTEM.md` | User model fields, directory ranking, profile completeness signals |
| Designer Shop | `docs/16_DESIGNER_SHOP_SYSTEM.md` | Shop tab on profile, product testimonials, vendor boosts |
| Interview System Audit | `tasks/INTERVIEW_SYSTEM_AUDIT.md` | ProfileInterview model, voice profile, generated outputs |
| Monetization & Verification | `docs/14_MONETIZATION_AND_VERIFICATION.md` | Designer tiers, org verification, profile completeness as ranking signal |
| Go-to-Market | `docs/11_GO_TO_MARKET_SEQUENCING.md` | Phase 1 = designer publishing wedge, profile as core asset |
| Individual-First Architecture | `INDIVIDUAL_FIRST_ARCHITECTURE.md` | Base user type, capability restrictions |

### Design Language
- Color: `#2C2825` (text), `#5C564F` (secondary), `#8B8178` (tertiary), `#F5F3F0` (bg elevated), `#B8845C` (accent)
- Typography: Cormorant Garamond (headlines), Instrument Sans (body)
- Components: `.ridge-card` for sections, ring border profile images, specialty pills

---

## 2. PROFILE-RELATED PAGES (5 distinct profile surfaces)

### A. `/designer/profile` — Authenticated Designer Dashboard
- **File**: `src/app/designer/profile/page.tsx` (411 lines, client-side)
- **Purpose**: Logged-in designer's own profile view + editing
- **Features**:
  - Edit mode for: name, title, bio, location, studio, phone, website, instagram
  - Published projects displayed via `EditorialMosaic`
  - "Known For Products" (top 10 tagged products)
  - Folio Fingerprint (style descriptors from specialties)
  - Editorial Bio component
  - Private analytics (Influence Metrics) — only visible to owner/admin
  - CTAs: Atelier Model indicators, Surge Pricing badge
- **API**: `GET/PUT /api/designer/profile`
- **Data**: Fetches from `getMyProjects('published')` + product tag aggregation

### B. `/profile/[userId]` — Public Profile (Unified)
- **File**: `src/app/profile/[userId]/page.tsx` (291 lines, server-side)
- **Purpose**: Public view of any user's profile
- **Features**:
  - ProfileHero (image, name, title, location, stats, follow/contact CTAs)
  - Pinned items carousel (projects, media, recognition, collaborations)
  - Tabbed navigation: Feed | Shop | About
  - Feed: unified content stream with filters (all/projects/media/recognition/collaborations) and sort (featured/recent/engagement)
  - Shop: designer's product shop
  - About: bio, philosophy, process, credentials, team, org affiliation
- **Components**: `ProfileHero`, `ProfileTabs`, `ProfileFeed`, `ProfileShop`, `ProfileAbout`, `PinnedCarousel`
- **Data**: Direct Prisma queries + profileInterview data + org team members

### C. `/monograph/[username]` (aka `/@username`) — Public Monograph Page
- **File**: `src/app/monograph/[username]/page.tsx` (239 lines, server-side)
- **Purpose**: Editorial, magazine-style public profile (the "beautiful" one)
- **Features**:
  - Full-bleed hero image from top project
  - Opening quote (from bio)
  - Fingerprint tags (currently hardcoded! TODO in code)
  - Selected Works grid (published projects)
  - Known For products carousel
  - Services section
  - Colophon footer
- **URL Rewrite**: `/@username` → `/monograph/username` via `next.config.js`
- **Username Resolution**: Cascading lookup by email prefix → exact name → name without spaces → name contains → fallback to first designer (TODO: remove in production)
- **Components**: `Hero`, `Fingerprint`, `SelectedWorks`, `KnownFor`, `Services`, `Colophon`, `EmptyState`

### D. `/profile` — Account Settings
- **File**: `src/app/profile/page.tsx` (584 lines, client-side)
- **Purpose**: "My Profile" settings page for any user
- **Features**:
  - Edit: name, bio, location, website, instagram, linkedin
  - Organization membership list with visibility toggle (`showOnProfile`)
  - Upgrade CTA for INDIVIDUAL users without orgs
- **API**: `GET/PUT /api/auth/me`

### E. `/org/[orgId]` — Organization Profile
- **File**: `src/app/org/[orgId]/page.tsx`
- **Purpose**: Organization-level profile page
- **Features**:
  - OrgProfileHero (logo, name, type, location, specialties, stats)
  - Pinned items carousel
  - Tabs: Feed | About
  - About tab: bio, philosophy, team, process phases, recognition, studio details
  - Profile Completeness Indicator (for owner)
- **Onboarding modals**: BioInterviewModal, AddTeamMemberModal, StudioDetailsModal, ProcessBuilderModal, RecognitionModal

---

## 3. FEATURE FLAGS

**Finding: NO profile-specific feature flags exist.**

Profile features are gated by:
1. **Publication status** — projects visible only if `isPublic: true` OR `publishedAt != null` OR `status: 'published'`
2. **Owner vs. visitor** — edit buttons, analytics visible only to profile owner
3. **Role-based** — INDIVIDUAL users see upgrade CTA, DESIGNER users see full profile tools

Existing feature flags in `src/lib/flags.ts`:
- `glassLandingRail`, `vendorNewDashboard`, `vendorAIInsights`, `vendorDemoData`, `realtimeInterview`
- None are profile-related

---

## 4. BIO INTERVIEW FLOW — End-to-End Trace

### Two Separate Bio Interview Systems

#### A. Organization Bio Interview (FULLY IMPLEMENTED)
- **Trigger**: "Start Bio Interview" button on org About tab (`OrgAboutTab.tsx:100`)
- **Component**: `BioInterviewModal.tsx` — immersive full-screen dialog
- **3-Layer Interview**:
  - **Layer 1 (Foundation)**: Origin story, philosophy, project types, location/regions, ideal client
  - **Layer 2 (Context)**: Dynamic follow-ups based on L1 answers (residential focus, multi-founders, sustainability, hospitality, luxury)
  - **Layer 3 (Proof Points)**: Representative project, recognition, collaborators
- **API Flow**:
  1. `POST /api/orgs/[orgId]/bio-interview` — saves raw answers to `OrgBioInterview` model
  2. `POST /api/orgs/[orgId]/bio-interview/generate` — calls `generateOrgBio()` using Anthropic Claude API
- **AI Generation** (via `src/lib/org-onboarding/generate-org-bio.ts`):
  - Uses Anthropic Claude API (`ANTHROPIC_ENABLED=true` + `ANTHROPIC_API_KEY`)
  - Generates: `fullBio`, `shortBio` (80 words), `pullQuotes[]`, `philosophyTagline`, `processDescription`
  - Stores outputs back to `OrgBioInterview` record
- **Progress Tracking**: Sets `bioInterviewComplete: true` in `OrgOnboardingProgress`

#### B. Individual Profile Interview (SCHEMA EXISTS, NO UI FLOW)
- **Prisma Model**: `ProfileInterview` — exists with fields: `answers` (JSON), `generatedBio`, `shortBio`, `pullQuotes`, `philosophyStatement`, `processDescription`, `status` (DRAFT/PUBLISHED)
- **Data Display**: `ProfileAbout.tsx` and `ProfileHero.tsx` read from `profileInterview` relation
- **Public profile `/profile/[userId]`**: Queries `profileInterview` data and passes to components
- **MISSING**: No interview modal/flow component for individual users. No API endpoint to create/generate individual profile interviews. The data model exists and is consumed on display, but there's no way for a user to populate it through the UI.

---

## 5. PUBLISHED PROJECTS NOT SHOWING ON PROFILE — Root Cause Analysis

### The Query Logic is Correct (in some places)
The `getMyProjects('published')` query in `/api/designer/profile` correctly filters:
```typescript
OR: [
  { isPublic: true },
  { publishedAt: { not: null } },
  { status: 'published' }
]
```

### Potential Issues Found

1. **Public profile `/profile/[userId]`** uses a DIFFERENT query for project count:
   ```typescript
   prisma.project.count({
     where: { designerId: resolvedParams.userId, isPublic: true }
   })
   ```
   This only checks `designerId` + `isPublic: true` — it **misses** projects where `publishedAt != null` or `status: 'published'`. The count on the public profile hero may undercount.

2. **Monograph page** uses `getDesignerPublishedProjects(designer.id)` which correctly uses the full OR filter, but only checks `designerId` (not ownerId, org, or participant). If the project was uploaded under the org, it won't show.

3. **`getDesignerProjects()` in `getMyProjects.ts:133`** (used for public profiles) only filters `isPublic: true` — it doesn't check `publishedAt` or `status: 'published'`.

4. **Multiple ownership paths**: `getMyProjects` checks 4 ownership paths (designerId, ownerId, designerOrgId, participant). Other queries only check `designerId`. If a project was created under an org context without setting `designerId`, it won't appear on the designer's public profile.

### Data Display Gaps

| Field | Stored In DB? | `/designer/profile` | `/profile/[userId]` | `/monograph` |
|-------|--------------|---------------------|---------------------|--------------|
| Name | Yes | Yes | Yes (ProfileHero) | Yes (Hero) |
| Bio | Yes | Yes (EditorialBio) | Yes (ProfileAbout) | Yes (quote) |
| Profile Image | Yes | Yes | Yes (ProfileHero) | No (uses project hero) |
| Location | Yes | Yes | Yes (ProfileHero) | Yes |
| Title | Yes | Yes | Yes (ProfileHero) | No |
| Studio | Yes | Yes (editing only) | No | No |
| Phone | Yes | Yes | No | No |
| Website | Yes | Yes (icon link) | Yes (ProfileAbout) | No |
| Instagram | Yes | Yes (icon link) | Yes (ProfileAbout) | No |
| LinkedIn | Yes | No (not in edit form) | Yes (ProfileAbout) | No |
| Specialties | Yes | Yes (FolioFingerprint) | Yes (ProfileAbout) | Hardcoded |
| Generated Bio | Yes (ProfileInterview) | No | Yes (ProfileAbout) | No |
| Short Bio | Yes (ProfileInterview) | No | Yes (could show) | No |
| Pull Quotes | Yes (ProfileInterview) | No | Yes (ProfileAbout) | No |
| Philosophy | Yes (ProfileInterview) | No | Yes (ProfileAbout) | No |
| Process Desc | Yes (ProfileInterview) | No | Yes (ProfileAbout) | No |
| Published Projects | Yes | Yes (EditorialMosaic) | Yes (ProfileFeed) | Yes (SelectedWorks) |
| Top Products | Yes (aggregated) | Yes (KnownForProducts) | No | Yes (KnownFor) |

---

## 6. ONBOARDING FLOWS

### A. Designer Onboarding (`/onboarding`)
- **5-screen welcome sequence** — informational only (value prop, expectations, benefits)
- **No profile data collected** — just marks `onboardingCompletedAt`
- **Optional Brand Setup** (`/designer/onboarding/brand`) — collects logo URL, colors, fonts, website URL → stores to `DesignerBrandProfile`

### B. Organization Onboarding (progressive, on org profile page)
- **6-step completeness tracker** on org About tab:
  1. Bio interview (3-layer AI interview → generates bio/tagline/quotes)
  2. Studio details (founded year, team size, services, regions, memberships, certifications)
  3. Team members (invite by email, headshot, role, individual quiz)
  4. Design process (named phases with descriptions)
  5. Recognition & press (awards, features, speaking)
  6. Featured work (pinning projects)
- **All tracked via**: `OrgOnboardingProgress` boolean flags
- **Rich data collection**: Bio interview alone asks 8-13 questions across 3 layers

### C. Project Workflow Guide (`GuideCard.tsx`)
- **4-step Getting Started** on project dashboard:
  1. Upload project photos
  2. Tag products
  3. AI Interview
  4. Publish
- Shows `X of 4 steps complete`
- This is per-project, not profile-level

---

## 7. PROFILE STATE MACHINE (Aesthetic System)

State machine in `src/lib/profile/getProfileState.ts`:

| State | Condition | UI |
|-------|----------|-----|
| `empty` | No projects, no brand | EmptyProfileState |
| `brand_only` | Brand assets but no projects | BrandOnlyProfileState |
| `projects_only` | 1+ projects, no aesthetic | ProjectsOnlyProfileState + suggestion banner |
| `ready` | 2+ projects (threshold for detection) | Triggers aesthetic detection |
| `generated` | AI detected aesthetic | Themed shell (Minimal/Editorial/Warm/Moody/Bold) |
| `customized` | User modified aesthetic | Custom-themed shell |

**6 aesthetic shell themes**: MinimalShell, EditorialShell, WarmShell, MoodyShell, BoldShell, DefaultShell (+ CoastalShell aliased to Warm)

**ProfileProgressIndicator** shows: projects (0/2), brand (optional), profile generated status

---

## 8. KEY FINDINGS & ISSUES

### Architecture Issues
1. **5 separate profile surfaces** with inconsistent data, queries, and UI — `/designer/profile`, `/profile/[userId]`, `/monograph/[username]`, `/profile`, `/org/[orgId]`
2. **Inconsistent published project queries** — some use full OR filter, some only check `isPublic: true`, some only check `designerId`
3. **No way to populate ProfileInterview for individuals** — model exists, display components exist, but no creation flow
4. **Monograph fingerprint tags are hardcoded** (line 113: `return ['Warm Neutrals', 'Textural Contrast', ...]`)
5. **Monograph username fallback** returns first designer if no match (line 98-104: "TODO: Remove this in production")

### Data Gaps
6. **ProfileInterview data** not accessible from `/designer/profile` (the page designers actually use)
7. **LinkedIn** editable on `/profile` settings but NOT in `/designer/profile` edit mode
8. **Studio** field editable on `/designer/profile` but NOT on `/profile` settings
9. **Specialties** not editable from any profile editing UI (only displayed)

### Missing Features
10. **No profile photo upload** — field exists but no upload UI on any profile page
11. **No public profile link** from `/designer/profile` — designer can't see how their public profile looks
12. **No profile preview** — no way to see visitor view vs. owner view

---

## 9. COMPONENT INVENTORY

### Profile Components (17+)
| Component | Location | Purpose |
|-----------|----------|---------|
| ProfileHero | `src/components/profile/unified/ProfileHero.tsx` | Public profile header |
| ProfileAbout | `src/components/profile/unified/ProfileAbout.tsx` | About tab content |
| ProfileFeed | `src/components/profile/unified/ProfileFeed.tsx` | Feed tab content |
| ProfileTabs | `src/components/profile/unified/ProfileTabs.tsx` | Tab navigation |
| ProfileShop | `src/components/profile/unified/ProfileShop.tsx` | Shop tab content |
| PinnedCarousel | `src/components/profile/unified/PinnedCarousel.tsx` | Pinned items |
| DesignerProfileShell | `src/components/profile/DesignerProfileShell.tsx` | Aesthetic router |
| EmptyProfileState | `src/components/profile/states/EmptyProfileState.tsx` | No-content state |
| BrandOnlyProfileState | `src/components/profile/states/BrandOnlyProfileState.tsx` | Brand-only state |
| ProjectsOnlyProfileState | `src/components/profile/states/ProjectsOnlyProfileState.tsx` | Projects-only state |
| ProfileProgressIndicator | `src/components/profile/ProfileProgressIndicator.tsx` | Progress widget |
| MinimalShell | `src/components/profile/shells/MinimalShell.tsx` | Minimal theme |
| EditorialShell | `src/components/profile/shells/EditorialShell.tsx` | Editorial theme |
| WarmShell | `src/components/profile/shells/WarmShell.tsx` | Warm theme |
| MoodyShell | `src/components/profile/shells/MoodyShell.tsx` | Moody theme |
| BoldShell | `src/components/profile/shells/BoldShell.tsx` | Bold theme |
| DefaultShell | `src/components/profile/shells/DefaultShell.tsx` | Default fallback |

### Org Profile Components
| Component | Location | Purpose |
|-----------|----------|---------|
| OrgAboutTab | `src/components/org-onboarding/OrgAboutTab.tsx` | Org about + onboarding |
| BioInterviewModal | `src/components/org-onboarding/BioInterviewModal.tsx` | 3-layer interview |
| ProfileCompletenessIndicator | `src/components/org-onboarding/ProfileCompletenessIndicator.tsx` | 6-step progress |
| AddTeamMemberModal | `src/components/org-onboarding/AddTeamMemberModal.tsx` | Team setup |
| StudioDetailsModal | `src/components/org-onboarding/StudioDetailsModal.tsx` | Studio info |
| ProcessBuilderModal | `src/components/org-onboarding/ProcessBuilderModal.tsx` | Process phases |
| RecognitionModal | `src/components/org-onboarding/RecognitionModal.tsx` | Awards/press |

### Monograph Components
| Component | Location | Purpose |
|-----------|----------|---------|
| Hero | `src/components/monograph/Hero.tsx` | Full-bleed hero |
| Fingerprint | `src/components/monograph/Fingerprint.tsx` | Style tags |
| SelectedWorks | `src/components/monograph/SelectedWorks.tsx` | Project grid |
| KnownFor | `src/components/monograph/KnownFor.tsx` | Product carousel |
| Services | `src/components/monograph/Services.tsx` | Services section |
| Colophon | `src/components/monograph/Colophon.tsx` | Footer |
| EmptyState | `src/components/monograph/EmptyState.tsx` | No projects state |

---

## 10. API ENDPOINTS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/designer/profile` | GET | Authenticated designer's own profile + projects + metrics |
| `/api/designer/profile` | PUT | Update designer profile fields |
| `/api/profile/[userId]` | GET | Public profile data for any user |
| `/api/profile/[userId]/feed` | GET | Unified feed with filters/sort |
| `/api/profile/[userId]/shop` | GET | Designer shop products |
| `/api/profile/pinned` | POST/DELETE | Manage pinned items |
| `/api/auth/me` | GET/PUT | Account settings profile data |
| `/api/auth/me/orgs/[membershipId]` | PATCH | Toggle org visibility |
| `/api/orgs/[orgId]/bio-interview` | GET/POST | Org bio interview data |
| `/api/orgs/[orgId]/bio-interview/generate` | POST | AI bio generation |
| `/api/orgs/[orgId]/onboarding-progress` | GET | Org completion progress |
| `/api/orgs/[orgId]/studio-details` | PATCH | Studio detail updates |
| `/api/orgs/[orgId]/team` | POST | Add team members |
| `/api/orgs/[orgId]/process-phases` | POST | Add process phases |
| `/api/orgs/[orgId]/recognition` | POST | Add recognition items |
| `/api/contributor/profile` | GET/PUT | Contributor profile |
| `/api/users/[userId]/taste-profile` | GET | Taste intelligence |
| `/api/get-designer-profile` | GET | **DEPRECATED** (mock data) |
| `/api/update-designer-profile` | POST | **DEPRECATED** (mock data) |

---

## 11. DATABASE MODELS

### User Profile Fields
Core: `id`, `email`, `name`, `bio`, `profileImage`
Professional: `title`, `location`, `phone`, `studio`, `specialties[]`
Social: `website`, `instagram`, `linkedin`
Metrics: `followers`, `following`, `views`
Aesthetic: `aestheticProfile` (JSON), `aestheticDetectedAt`, `profileState`
Architect: `architectLicenseNumber`, `architectLicensedStates[]`, `architectProjectScale`, `architectSpecializations[]`
Builder: `builderProjectTypes[]`, `builderSquareFootageRange`, `builderSpecialtyTrades[]`, `builderYearsInBusiness`

### ProfileInterview (individual, 1:1 with User)
`answers` (JSON), `generatedBio`, `shortBio`, `pullQuotes` (JSON), `philosophyStatement`, `processDescription`, `status`

### OrgBioInterview (organization, 1:1 with Organization)
L1: `originStory`, `philosophyStatement`, `projectTypes[]`, `location`, `serviceRegions[]`, `idealClient`
L2: `layer2Responses` (JSON)
L3: `representativeProjectId`, `recognitionMentions`, `collaboratorMentions`
Generated: `fullBio`, `shortBio`, `pullQuotes` (JSON), `philosophyTagline`, `processDescription`, `generatedAt`

### OrgOnboardingProgress (1:1 with Organization)
Booleans: `bioInterviewComplete`, `studioDetailsComplete`, `teamSetupComplete`, `processComplete`, `recognitionComplete`, `vendorRelationshipsComplete`, `pinnedWorkComplete`

### DesignerBrandProfile / DesignerBrandAssets
Brand identity: logos, colors, fonts, mood images, inspiration, tagline, brand adjectives
