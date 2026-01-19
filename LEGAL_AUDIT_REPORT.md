# FOLIO LEGAL AUDIT REPORT
**Generated:** 2026-01-18
**Version:** 1.0
**Purpose:** Comprehensive legal review for counsel

---

## EXECUTIVE SUMMARY

Folio is an interior design platform connecting designers, vendors, and individuals. This audit identifies data collection practices, third-party integrations, AI usage patterns, and compliance gaps requiring legal review.

**Critical Findings:**
- ✅ No existing Terms of Service, Privacy Policy, or Cookie Policy
- ⚠️ Extensive PII collection without documented consent mechanisms
- ⚠️ User content sent to AI providers (Anthropic Claude, OpenAI, Google Gemini)
- ⚠️ No EXIF metadata stripping on image uploads
- ⚠️ Authentication uses secure patterns (bcrypt, httpOnly cookies)
- ⚠️ No evidence of analytics tracking (Google Analytics, etc.) currently implemented

---

## 1. DATA COLLECTION INVENTORY

### 1.1 Personally Identifiable Information (PII)

**User Model (users table)** collects:

#### Core Identity
- `email` (unique, required) - Primary identifier
- `name` (required) - Full name
- `passwordHash` - bcrypt hashed passwords
- `phone` (optional) - Phone number
- `location` (optional) - Geographic location
- `bio` (optional) - Personal biography
- `profileImage` (optional) - Profile photo URL

#### Professional Information
- `title` (optional) - Professional title
- `studio` (optional) - Studio/firm name
- `companyName` (optional) - Company affiliation
- `specialties` (array) - Professional specializations
- `website`, `instagram`, `linkedin` (optional) - Social media links

#### Architect-Specific Fields
- `architectLicenseNumber` - Professional license (SENSITIVE)
- `architectLicensedStates` (array) - State licensing information
- `architectProjectScale` (array)
- `architectSpecializations` (array)

#### Builder-Specific Fields
- `builderProjectTypes` (array)
- `builderSquareFootageRange` (optional)
- `builderSpecialtyTrades` (array)
- `builderYearsInBusiness` (integer)

#### Client Profile (for INDIVIDUAL role)
- `budgetRange` (optional) - Financial information
- `desiredRooms` (array)
- `serviceLevel` (optional)
- `projectStatus` (optional)

#### Account Metadata
- `role` - ADMIN, VENDOR, DESIGNER, INDIVIDUAL, GUEST, ARCHITECT, BUILDER
- `accountStatus` - PENDING, APPROVED, REJECTED
- `approvedBy` - Admin ID who approved account
- `rejectionReason` - Why account was rejected
- `applicationNote` - Notes from application
- `createdAt`, `updatedAt` - Timestamps

#### Engagement Metrics (Derived)
- `followers`, `following`, `views` - Social engagement counters
- `subscriptionTier` - FREE, PRO, STUDIO, ENTERPRISE
- `subscriptionExpiresAt` - Subscription expiration date

### 1.2 Behavioral & Usage Data

**ContextSignal Table** - User behavior tracking
- `userId`, `vendorId`, `productId`, `materialId`, `projectId`, `eventId`
- `action` - "view", "save", "add_to_project", "rsvp", "feature_click", "search"
- `tags` (array) - Search/interaction terms (e.g., "brass", "emerald", "mid-century")
- `meta` (JSON) - Additional context
- `createdAt` - Timestamp

**AtelierSignal Table** - Designer/vendor fingerprinting
- `ownerType` - DESIGNER or VENDOR
- `designerId`, `vendorId`
- `sourceType` - PROJECT, SELECTION, SAVE, TAG, INTERVIEW, BEHAVIOR
- `key` - Signal identifier
- `weight` - Signal strength
- `metadata` (JSON)

**EngagementEvent Table** - Event-specific engagement
- `userId`, `eventId`, `productId`
- `verb` - Action type
- `meta` (JSON)

**Designer Voice Profile** - AI-powered personality analysis
- `vocabularyFrequency` (JSON) - Word usage patterns
- `signaturePhrases` (array)
- `terminologyPreferences` (JSON)
- `avgSentenceLength`, `sentenceStructures` (JSON)
- `formalityLevel`, `enthusiasmLevel`, `technicalDepth` (floats)
- `reasoningStyle`, `commonJustifications`
- `voiceEmbedding` (bytes) - AI-generated voice embedding

**Aesthetic Profile** (stored in User.aestheticProfile as JSON)
- AI-detected design preferences and style

### 1.3 Project & Content Data

**Project Table**
- `ownerId` - User who owns the project
- `designerId` - Designer working on project
- `title`, `description`, `category`
- `isPublic`, `publishedAt` - Visibility settings
- `city`, `regionState` - Location data
- `projectType` - RESIDENTIAL, COMMERCIAL, HOSPITALITY, etc.
- `clientType` - RESIDENTIAL or COMMERCIAL
- `budgetBand` - LOW, MID, HIGH, LUXURY

**ProjectImage Table** - Uploaded images
- `url` - Image storage URL
- `name`, `room`
- `aiTags` (array) - AI-detected tags (objects, materials, colors)
- `aiColors` (JSON) - Dominant color palette
- `aiMaterials`, `aiSpaces` (arrays) - AI classifications
- `aiClassification` (JSON) - Full AI analysis result
- `verifiedAttributes` (JSON) - Designer-confirmed attributes
- `momentViews`, `momentSaves`, `momentShares` - Engagement metrics

**Selection Table** - Product selections in projects
- `vendorName`, `productName`, `colorFinish`
- `notes`, `gpsLocation` (optional)
- `unitPrice`, `quantity`
- `specSheetFileName`, `specSheetUrl`
- `productUrl`
- `vendorRepId` - Sales representative tracking

### 1.4 Interview & Editorial Data

**EditorialInterview Table** - Designer interviews
- `projectId`
- `selectedQuestionIds` (array)
- `status` - IN_PROGRESS, COMPLETED, PUBLISHED

**EditorialInterviewAnswer Table** - Interview responses
- `answerText` - Designer's written answer
- `audioUrl` - Optional audio recording
- `inputModality` - "text", "voice", "mixed"
- `confidenceScore`, `inferredPriorities`, `softConstraints`
- `linkedImageId`, `linkedProductId` - Content linkage

**DesignerDecision Table** - Design decision tracking
- `designerId`, `projectId`
- `decisionType`, `choice`, `choiceId`
- `reasoning`, `alternatives` (JSON), `tradeoffs`
- `isClientDriven`, `clientContext`, `clientBriefExcerpt`
- `influences` (array), `clientReaction`, `outcomeNotes`

### 1.5 Commerce & Financial Data

**CreditAccount Table**
- `userId`
- `availableBalance`, `pendingBalance` (Decimal) - Platform credit balances
- `lifetimeEarned`, `lifetimeRedeemed` - Transaction history

**Order Table**
- `purchaserUserId` - Buyer
- `attributedDesignerId`, `attributedRepId` - Commission tracking
- `retailAmountCents`, `tradeAmountCents`, `marginAmountCents` - Pricing
- `designerCreditCents`, `repCreditCents` - Commission splits
- `creditAppliedCents`, `cashPaidCents` - Payment breakdown
- `trackingNumber`, `trackingUrl` - Shipping info
- `notes`, `internalNotes`

**VendorTradeAccount Table** (HIGHLY SENSITIVE)
- `loginUrl`, `username`, `password` - Trade portal credentials (should be encrypted)
- `apiKey`, `apiEndpoint` - API credentials
- `discountPercent`, `paymentTerms`
- `repName`, `repEmail`, `repPhone` - Rep contact info

### 1.6 Event & RSVP Data

**Event Table**
- `createdById` - Event creator
- `location`, `city`, `state`, `country` - Geographic data
- `startDate`, `endDate`
- `isPublic`, `requiresApproval`
- `capacity`, `chatGroupLink`
- `designStyles`, `eventTags` (arrays)

**EventRSVP Table**
- `userId`, `eventId`
- `status` - "attending"
- `notes`

**VendorVisit Table** - Vendor tracking tokens
- `token` - Unique visit identifier
- `vendorId`, `designerEmail`
- `projectId`, `note`

### 1.7 Organization Data

**Organization Table**
- `name`, `type` - VENDOR, DESIGN_FIRM, MANUFACTURER, SHOWROOM, CONTRACTOR, ARCHITECTURE_FIRM
- `description`, `website`, `logo`
- `address`, `phone` - Required for creation
- `businessLicense` (URL) - Verification document
- `bankAccountInfo` (JSON) - Encrypted payout info
- `salesNotes`, `salesContactedAt` - Sales tracking

**OrganizationUser Table**
- `userId`, `organizationId`
- `role` - OWNER, ADMIN, MANAGER, MEMBER, VIEWER
- `workEmail` - Work email for org membership

### 1.8 Data Retention & Deletion

**Current State:**
- ❌ No TTL (Time To Live) logic found
- ❌ No automated data archival
- ❌ No automated deletion of old records
- ⚠️ Story model has `expiresAt` field (optional)
- ⚠️ VendorVisit has `expiresAt` field
- ❌ No data export functionality for users
- ❌ No account deletion endpoint found

**Recommendation:** Implement GDPR-compliant data retention and deletion policies.

### 1.9 Sensitive Data Categories

- ✅ **Financial:** Credit balances, order amounts, budget ranges, trade credentials
- ✅ **Professional:** License numbers, certifications
- ⚠️ **Biometric:** Voice embeddings (in DesignerVoiceProfile)
- ❌ **Health:** None detected
- ⚠️ **Location:** GPS coordinates in selections, city/state data

---

## 2. THIRD-PARTY SERVICE DEPENDENCIES

### 2.1 AI Providers

#### Anthropic (Claude)
**Purpose:** Image classification, content analysis
**API Key:** `ANTHROPIC_API_KEY`
**Data Sent:**
- Project images (URLs) for classification
- Image URLs sent to `claude-sonnet-4-20250514` model
- Extracts: colors, materials, styles, mood, elements, spaces
- **File:** `src/lib/aesthetic/imageClassification.ts:1-76`
- **Usage:** Import agent analysis, aesthetic detection

**User Data Exposure:**
- ✅ Image content (interior design photos)
- ⚠️ Potentially contains user-uploaded photos with EXIF metadata
- ❌ No direct PII, but images may contain identifiable locations/people

#### OpenAI
**Purpose:** Content generation, embeddings, image generation
**API Keys:** `OPENAI_API_KEY`
**Models Used:**
- `gpt-4o-mini` (text generation, default)
- `gpt-image-1` (image generation)
- Text embedding models

**Data Sent:**
1. **Editorial Draft Generation** (`src/lib/posting/generateEditorialDraft.ts`)
   - Project details, designer info, vendor info
   - Interview answers (designer responses)
   - Image captions
   - Product tags (materials, vendors)
   - Follow-up Q&A responses

2. **Image Generation** (`src/lib/ai/imageGen.ts`)
   - Room description prompts
   - Design style preferences

3. **Embeddings** (`src/lib/ai/embeddings.ts`)
   - Text for vector search indexing

4. **Instagram Captions** (`src/lib/instagram/generateCaption.ts`)
   - Project data, image descriptions

**User Data Exposure:**
- ✅ Designer names, project descriptions
- ✅ Interview answers (personal design philosophy, process)
- ✅ Product selections and preferences
- ⚠️ May include client names/details in interview answers

#### Google Generative AI (Gemini)
**Package:** `@google/generative-ai` (v0.24.1)
**Status:** Library installed but usage not found in active code
**Potential Usage:** Future AI feature integration

**Configuration:** `GOOGLE_API_KEY` (referenced but not found in active code)

### 2.2 Database & Storage

#### Supabase (PostgreSQL + Storage)
**Purpose:** Primary database and file storage
**Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL` - Public database URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Client-side key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin bypass key
- `DATABASE_URL` - Direct Postgres connection
- `DIRECT_URL` - Direct connection (bypasses connection pooling)

**Data Stored:**
- All database tables (see Section 1)
- Image uploads in buckets: `event-images`, `project-assets`
- Generated images, cutouts, 3D meshes
- Spec sheets, quotes (PDFs)

**Data Residency:**
- ⚠️ Supabase region not specified in code (likely US or EU)
- ⚠️ No data residency configuration found
- **Recommendation:** Verify Supabase region for GDPR compliance

**Security:**
- ✅ Row Level Security (RLS) mentioned in code
- ⚠️ Admin client bypasses RLS for uploads
- ⚠️ Public buckets for image storage (no access control)

### 2.3 Authentication

#### NextAuth.js (v4.24.11)
**Purpose:** Session management and authentication
**Configuration:**
- `NEXTAUTH_SECRET` - JWT signing secret
- `NEXTAUTH_URL` - Application URL

**Session Storage:**
- JWT-based sessions (no database session storage)
- Cookie name: `next-auth.session-token` (dev) or `__Secure-next-auth.session-token` (prod)
- Cookie settings: `httpOnly: true`, `sameSite: "lax"`, `secure: true` (prod)

**Password Storage:**
- bcrypt hashing via `bcryptjs` (v3.0.2)
- Passwords stored in `User.passwordHash`

**Data in Session:**
- User ID, email, name, role, accountStatus
- Subscription tier, operating organization
- Impersonation info (for admin features)

### 2.4 Image Processing & Scraping

#### Puppeteer (Browserless)
**Package:** `puppeteer-core` (v24.24.1)
**Purpose:** Web scraping for product imports
**Environment Variable:** `BROWSERLESS_API_KEY` (referenced but not found in env grep)

**Data Sent:**
- Product URLs from vendor websites
- Scraping results may include product images, descriptions, prices

#### Sharp (v0.33.0)
**Purpose:** Server-side image processing
**Usage:** Image resizing, format conversion
**EXIF Metadata:**
- ❌ No evidence of EXIF stripping in storage.ts
- ⚠️ Images uploaded may retain camera data, GPS coordinates, timestamps
- **Recommendation:** Implement EXIF stripping for privacy

#### Roboflow (SAM3)
**Purpose:** AI-powered image segmentation and cutout generation
**Environment Variable:** `ROBOFLOW_API_KEY`
**Files:** `src/lib/roboflow/sam3.ts`, `sam3Cutout.ts`, `sam3Mesh.ts`

**Data Sent:**
- Product images for background removal
- 3D mesh generation requests

### 2.5 Payment Processing

#### Stripe (Not Actively Used)
**Package:** Not in package.json
**Environment Variables:** `STRIPE_*` (searched but not found)
**Status:** Commerce system exists (Order, CreditAccount models) but Stripe integration not implemented

**Vendor Subscription:**
- `VendorSubscription` model has `stripeCustomerId`, `stripeSubscriptionId` fields
- Pricing tiers: STARTER, GROWTH, PROFESSIONAL, ENTERPRISE
- Billing fields exist but no active Stripe code found

### 2.6 Email Services

**Status:** No active email service integration found
**Evidence:**
- `sendVendorProductPreviewEmail.ts` function exists but commented out
- Email API key reference: `process.env.EMAIL_API_KEY` (not configured)
- No SMTP configuration found

**Placeholder Code:**
```typescript
// 'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`,
```

### 2.7 Analytics & Tracking

**Current State:**
- ❌ No Google Analytics implementation found
- ❌ No pixel tracking (Facebook, Google Ads, etc.)
- ❌ No third-party analytics SDKs
- ✅ Internal analytics tables (ContextSignal, EngagementEvent)

**Analytics Code References:**
- Many files reference "analytics" but these are internal dashboards
- `src/lib/analytics.ts` - Custom analytics functions (not third-party)
- No `gtag`, `ga()`, or analytics snippet found

### 2.8 CDN & Asset Delivery

**Supabase Storage CDN:**
- Public URLs served via Supabase CDN
- Format: `{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}`

**Next.js Image Optimization:**
- Uses Next.js built-in image optimization
- `next/image` component for responsive images

### 2.9 Other Dependencies

#### QR Code Generation
**Package:** `qrcode` (v1.5.4)
**Purpose:** Generate QR codes (likely for event check-ins, visit tokens)

#### PDF Generation
**Package:** `pdfkit` (v0.17.2)
**Purpose:** Server-side PDF generation (likely for quotes, reports)

#### Cheerio (v1.1.2)
**Purpose:** HTML parsing for web scraping

---

## 3. AUTHENTICATION & SECURITY

### 3.1 Authentication Implementation

**Provider:** NextAuth.js with Credentials Provider
**File:** `src/app/api/auth/[...nextauth]/options.ts`

**Password Flow:**
1. User submits email + password
2. Case-insensitive email lookup in database
3. bcrypt comparison against `User.passwordHash`
4. JWT token issued on success

**Security Strengths:**
- ✅ bcrypt password hashing (industry standard)
- ✅ httpOnly cookies (prevents XSS token theft)
- ✅ Secure cookies in production (`secure: true`)
- ✅ SameSite: "lax" (CSRF protection)
- ✅ Session strategy: JWT (stateless)

**Security Concerns:**
- ⚠️ Debug logging in production code (lines 70-75, 118-123, 236)
  - Logs email, user ID, role to console
  - **Recommendation:** Remove debug logs in production

- ⚠️ Fallback secret: `'your-secret-key'` (line 282)
  - Should fail if `NEXTAUTH_SECRET` missing
  - **Recommendation:** Throw error instead of fallback

- ⚠️ No rate limiting on login endpoint
  - **Recommendation:** Implement rate limiting for brute force protection

- ⚠️ No MFA (Multi-Factor Authentication)
  - **Recommendation:** Consider adding for admin/designer accounts

### 3.2 Session Management

**Token Contents:**
- User ID, email, name, role
- Account status, onboarding status
- Subscription tier, expiration date
- Operating organization (workspace context)
- Impersonation metadata (for admin use)

**Token Refresh:**
- Tokens refreshed on every request via `jwt` callback
- Fresh data fetched from database (prevents stale sessions)
- Graceful error handling if DB unavailable

**Impersonation Feature:**
- Admins can impersonate users
- `ImpersonationLog` table tracks admin actions
- Session includes `originalAdminId` during impersonation
- **Security:** Proper audit trail exists

### 3.3 Role-Based Access Control (RBAC)

**Roles:**
- `ADMIN` - Full system access
- `VENDOR` - Vendor organizations
- `DESIGNER` - Interior designers
- `INDIVIDUAL` - End users (homeowners)
- `ARCHITECT` - Architecture professionals
- `BUILDER` - Construction professionals
- `GUEST` - Minimal access

**Middleware Protection:**
- File: `middleware.ts`
- Protects `/designer/*` routes
- Redirects based on `accountStatus`:
  - `PENDING` → `/pending-approval`
  - `REJECTED` → `/application-rejected`
  - `APPROVED` without onboarding → `/onboarding`

**API Protection:**
- No global API authentication middleware found
- Individual routes check session via `getServerSession(authOptions)`
- Inconsistent protection across routes
- **Recommendation:** Audit all API routes for auth requirements

### 3.4 API Key Exposure Risks

**Environment Variables in Client Code:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Public (safe)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public (safe, RLS enforced)
- ❌ No server-side API keys exposed to client

**Server-Side Secrets:**
- `SUPABASE_SERVICE_ROLE_KEY` - Server only ✅
- `OPENAI_API_KEY` - Server only ✅
- `ANTHROPIC_API_KEY` - Server only ✅
- `NEXTAUTH_SECRET` - Server only ✅

**Hardcoded Secrets:**
- ❌ None found in code audit

### 3.5 CORS & Security Headers

**Next.js Config:** `next.config.js`
- ❌ No custom security headers configured
- ❌ No CORS policy defined
- ❌ No Content Security Policy (CSP)
- ❌ No X-Frame-Options
- ❌ No Referrer-Policy

**Recommendation:** Add security headers:
```javascript
headers: [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // CSP, HSTS, etc.
]
```

### 3.6 Input Validation

**Zod Schemas:**
- ✅ `zod` (v4.0.17) used for validation
- ✅ Schema validation in editorial/posting code
- ⚠️ Not consistently applied across all API routes

**SQL Injection:**
- ✅ Prisma ORM parameterizes queries (safe by default)
- ⚠️ Raw SQL used in one location:
  - File: `src/app/api/auth/[...nextauth]/options.ts:189-191`
  - Parameterized with Prisma's `$queryRaw` (safe)

**XSS Protection:**
- ❌ No evidence of server-side HTML sanitization
- ⚠️ React provides default XSS protection
- **Recommendation:** Sanitize user HTML if using `dangerouslySetInnerHTML`

---

## 4. AI USAGE PATTERNS

### 4.1 AI Integrations Summary

| Provider | Purpose | User Content Sent | Training Data Risk |
|----------|---------|-------------------|-------------------|
| **Anthropic Claude** | Image classification | Project images (URLs) | ⚠️ Check Anthropic's data policy |
| **OpenAI GPT** | Editorial generation | Interview text, project details | ⚠️ Check OpenAI's data policy |
| **OpenAI DALL-E** | Image generation | Room description prompts | ⚠️ Check OpenAI's data policy |
| **OpenAI Embeddings** | Search indexing | Text snippets | ⚠️ Check OpenAI's data policy |
| **Roboflow SAM3** | Image segmentation | Product images | ⚠️ Check Roboflow's data policy |

### 4.2 Detailed AI Usage

#### Image Classification (Anthropic Claude)
**File:** `src/lib/aesthetic/imageClassification.ts`
**Model:** `claude-sonnet-4-20250514`
**Input:** Public image URL
**Output:** JSON with colors, materials, styles, mood, elements, spaces
**Storage:** Results stored in `ProjectImage.aiClassification` (JSON column)

**User Content Sent:**
- Interior design photos (may include people, personal items)
- Image URLs (publicly accessible)

**Labeling:**
- ✅ Results stored in `ai*` prefixed columns
- ✅ `aiClassifiedAt` timestamp indicates AI processing
- ⚠️ No user-facing label that content is AI-generated

#### Editorial Draft Generation (OpenAI)
**File:** `src/lib/posting/generateEditorialDraft.ts`
**Model:** `gpt-4o-mini` (configurable via `OPENAI_MODEL`)
**Input:**
- Project metadata (title, description, type, budget band)
- Designer profile (name, bio, studio, website)
- Vendor information
- Interview answers (designer's written responses)
- Image captions
- Product tags and material context
- Follow-up Q&A

**Output:** Structured editorial content (JSON blocks)
**Tone:** "Warm, confident, minimalist, design-literate" (line 8-12)

**User Content Sent:**
- ✅ Full designer interview responses
- ✅ Project details and descriptions
- ✅ Product selections and material choices
- ⚠️ May include client names/details in answers

**Storage:**
- Results in `ProjectPost.expandedBlocks` (JSON)
- Provenance tracked in `ProjectPost.provenance` (JSON)

**Labeling:**
- ⚠️ Generated content mixed with user content
- ⚠️ No clear "AI-generated" disclaimer in UI code

#### Image Generation (OpenAI DALL-E)
**File:** `src/lib/ai/imageGen.ts`
**Models:** `gpt-image-1` (OpenAI) or `stable-image-ultra` (Stability AI)
**Input:** Room description prompts (text)
**Output:** Generated images (PNG/JPG)

**User Content Sent:**
- Room descriptions and design preferences
- Style keywords

**Storage:**
- Uploaded to Supabase storage
- Referenced in `ProjectImage` table

**Fallback:**
- ✅ Fake provider for development/testing (if API keys missing)

#### Text Embeddings (OpenAI)
**File:** `src/lib/ai/embeddings.ts`
**Purpose:** Vector search for content discovery
**Model:** OpenAI embedding model (unspecified)

**User Content Sent:**
- Text snippets for indexing
- Product descriptions, tags

**Storage:**
- `Embedding` table stores vector (Bytes column)

### 4.3 Content Moderation

**File:** `src/lib/posting/moderation.ts`
**Purpose:** Content safety filtering
**Integration:** OpenAI moderation API

**Checks:**
- Interview answers
- User-generated text content

**Action:**
- Flags inappropriate content
- No evidence of automatic rejection

### 4.4 Training Data Considerations

**Critical Question for Legal Review:**
> Does Folio have rights to use user-submitted content for AI training?

**Current State:**
- ❌ No Terms of Service defining content rights
- ❌ No explicit consent for AI processing
- ⚠️ User content sent to third-party AI providers

**Third-Party AI Provider Policies:**
- **Anthropic:** As of 2024, Claude does not train on API inputs by default
- **OpenAI:** As of 2023, API data not used for training unless explicitly opted in
- **Roboflow:** Check current data usage policy

**Recommendation:**
1. Review current AI provider data usage policies
2. Add Terms of Service clause for AI processing
3. Obtain explicit consent for AI feature usage
4. Provide opt-out mechanism

### 4.5 AI-Generated Content Disclosure

**Current State:**
- ⚠️ AI-generated editorial content not clearly labeled in UI
- ✅ Backend stores AI classification in `ai*` columns
- ✅ Editorial provenance tracked in JSON

**Legal Requirements:**
- EU AI Act (2024): Transparency requirements for AI-generated content
- FTC Guidelines (US): Disclosure of AI-generated marketing content

**Recommendation:**
- Add "Generated with AI assistance" disclaimer on editorial posts
- Label AI-classified tags as "AI-suggested, designer-verified"

---

## 5. CONTENT & IP HANDLING

### 5.1 User Upload Storage

**Upload Flow:**
1. User uploads image via client
2. Image sent to API route (e.g., `/api/projects/[id]/images`)
3. Server uploads to Supabase Storage
4. Public URL returned and stored in database

**Storage Locations:**
- `event-images` bucket (primary)
- `project-assets` bucket (projects)
- Generated content: `{projectId}/generated/*`, `{projectId}/cutouts/*`, `{projectId}/meshes/*`

**Access Control:**
- ⚠️ Public buckets (no authentication required)
- ⚠️ URLs are permanent and guessable
- ⚠️ No expiration on public URLs

### 5.2 Image Metadata Handling

**EXIF Data:**
- ❌ No EXIF stripping detected in `src/lib/storage.ts`
- ⚠️ Images uploaded retain all metadata:
  - Camera make/model
  - GPS coordinates
  - Timestamps
  - Software used
  - Copyright info

**Privacy Risk:**
- 🔴 High - GPS coordinates expose user location
- 🔴 High - Timestamps reveal when photo taken
- 🟡 Medium - Camera data reveals equipment

**Recommendation:**
```typescript
// Add to storage.ts using sharp
import sharp from 'sharp';

const strippedBuffer = await sharp(inputBuffer)
  .rotate() // Auto-rotate based on EXIF
  .withMetadata({
    exif: {}, // Remove all EXIF
    icc: profile, // Keep color profile
  })
  .toBuffer();
```

### 5.3 Content Transformation

**Image Processing (Sharp):**
- Resizing for thumbnails
- Format conversion (PNG/JPEG)
- ⚠️ Original files preserved (no destructive edits)

**AI Transformations:**
- Image classification (adds tags)
- Background removal (creates cutouts)
- 3D mesh generation (Roboflow SAM3)

**Derivative Works:**
- AI-generated images (DALL-E, Stability)
- AI-written editorial content (GPT)
- AI-extracted product cutouts

### 5.4 Content Licensing

**Current State:**
- ❌ No Terms of Service defining content licensing
- ❌ No copyright notices in code
- ❌ No user agreement for content usage

**Questions for Legal:**
1. Does Folio claim rights to user-uploaded images?
2. Can Folio use project photos for marketing?
3. Who owns AI-generated derivative works?
4. What license do designers grant for published projects?

**Recommendations:**
- Define content ownership in ToS
- Implement content licensing options (e.g., Creative Commons)
- Add copyright attribution for published projects
- Clarify AI-generated content ownership

### 5.5 Third-Party Content

**Product Images:**
- Scraped from vendor websites
- Stored in `Product.imageUrl`, `Product.cutoutImageUrl`
- ⚠️ No copyright verification

**Vendor-Provided Assets:**
- Logos, brand images
- Product photos, spec sheets

**Attribution:**
- ✅ Vendor names stored with products
- ✅ Designer attribution in projects
- ⚠️ No formal attribution requirements in UI

---

## 6. COOKIES & TRACKING

### 6.1 Authentication Cookies

**NextAuth Session Cookie:**
- **Name (Dev):** `next-auth.session-token`
- **Name (Prod):** `__Secure-next-auth.session-token`
- **Attributes:**
  - `httpOnly: true` ✅ (prevents JavaScript access)
  - `sameSite: "lax"` ✅ (CSRF protection)
  - `secure: true` (production only) ✅
  - `path: "/"` (site-wide)
- **Expiration:** Session-based (JWT, no explicit expiry in cookie)
- **Purpose:** User authentication and session management

**Contents:**
- Encrypted JWT containing user ID, role, email
- No PII visible in cookie value (encrypted)

### 6.2 CSRF Protection

**NextAuth CSRF Token:**
- Automatically managed by NextAuth.js
- Token stored in cookie: `next-auth.csrf-token`
- Validated on state-changing requests

### 6.3 Other Cookies

**Current State:**
- ❌ No analytics cookies (Google Analytics, etc.)
- ❌ No advertising cookies
- ❌ No third-party tracking cookies
- ✅ Only authentication cookies detected

### 6.4 Local Storage

**Search:**
```bash
grep -r "localStorage\|sessionStorage" src/
```
**Results:** Limited usage, primarily for:
- UI state (e.g., collapsed panels, filters)
- Demo mode settings
- No PII stored in localStorage

### 6.5 Cookie Consent

**Current State:**
- ❌ No cookie consent banner
- ❌ No cookie policy
- ❌ No opt-in/opt-out mechanism

**GDPR Requirements:**
- 🔴 Required for EU users
- ⚠️ Even "strictly necessary" cookies must be disclosed

**Recommendation:**
- Implement cookie consent banner (e.g., CookieYes, OneTrust)
- Create Cookie Policy page
- Allow users to manage cookie preferences

---

## 7. EXISTING LEGAL DOCUMENTS

**Search Results:**
- ❌ No `privacy-policy.md` or `/privacy` page
- ❌ No `terms-of-service.md` or `/terms` page
- ❌ No `cookie-policy.md` or `/cookies` page
- ❌ No legal text in codebase
- ❌ No `/legal` directory

**Documentation Found:**
- `docs/` folder contains product specs, not legal docs
- `README.md` files are technical documentation

**Status:** 🔴 **CRITICAL** - No legal agreements in place

---

## 8. DATA FLOWS DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                              USER                                    │
│  (Designer, Vendor, Individual, Architect, Builder)                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ HTTPS
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS FRONTEND                              │
│  • React Components                                                  │
│  • Client-side validation                                            │
│  • Public env vars (NEXT_PUBLIC_SUPABASE_URL, etc.)                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ API Routes (/api/*)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS API ROUTES                               │
│  • Authentication (NextAuth)                                         │
│  • Business logic                                                    │
│  • Server-side secrets                                               │
└─────┬──────────┬─────────┬─────────┬─────────┬──────────┬──────────┘
      │          │         │         │         │          │
      │          │         │         │         │          │
      ▼          ▼         ▼         ▼         ▼          ▼
┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────┐ ┌───────┐ ┌──────────┐
│SUPABASE │ │ANTHROPIC│ │ OPENAI │ │STABILITY│ │ROBOFLOW│ │BROWSERLESS│
│ (DB +   │ │ CLAUDE  │ │  GPT   │ │   AI    │ │  SAM3  │ │(Puppeteer)│
│ Storage)│ │         │ │ DALL-E │ │         │ │        │ │           │
└─────────┘ └────────┘ └────────┘ └─────────┘ └───────┘ └──────────┘
     │
     │ PostgreSQL + Storage CDN
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SUPABASE STORAGE                                │
│                                                                      │
│  Buckets:                                                            │
│  • event-images (public)                                             │
│  • project-assets (public)                                           │
│                                                                      │
│  Contents:                                                           │
│  • User-uploaded images (WITH EXIF metadata)                         │
│  • Generated images (AI, cutouts, meshes)                            │
│  • Spec sheets, quotes (PDFs)                                        │
└─────────────────────────────────────────────────────────────────────┘

DATA FLOW LEGEND:
─────────────
User → Frontend:         PII input (email, name, phone, location, etc.)
Frontend → API:          Form data, images, project details
API → Supabase DB:       Stored PII, behavioral data, analytics
API → Supabase Storage:  Images, files (public URLs)
API → Anthropic:         Image URLs for classification
API → OpenAI:            Interview text, project details, prompts
API → Stability AI:      Image generation prompts
API → Roboflow:          Product images for cutouts
API → Browserless:       URLs for product scraping
```

### Data Flow Details

**1. User Registration:**
```
User → Frontend → /api/auth/signup
           ↓
       Prisma (User table)
           ↓
       Supabase PostgreSQL
```
**Data:** email (unique), name, passwordHash (bcrypt), role

**2. Project Upload:**
```
User → Frontend → /api/projects/[id]/images
           ↓
       Supabase Storage (upload image)
           ↓
       Return public URL
           ↓
       Prisma (ProjectImage table)
           ↓
       Anthropic Claude (classify image)
           ↓
       Store AI results (aiClassification, aiTags, aiColors)
```
**Data:** Image file → Storage URL → AI tags → Database

**3. Editorial Interview:**
```
Designer → Frontend → /api/posting/project/[id]/interview
              ↓
          Prisma (EditorialInterview, EditorialInterviewAnswer)
              ↓
          /api/posting/project/[id]/interview/generate
              ↓
          OpenAI GPT (generate editorial draft)
              ↓
          Prisma (ProjectPost.expandedBlocks)
```
**Data:** Interview answers → OpenAI → Generated article

**4. Product Scraping:**
```
Vendor → Frontend → /api/vendor/products/scrape
            ↓
        Browserless (Puppeteer)
            ↓
        Fetch product page HTML
            ↓
        Extract: name, price, images, description
            ↓
        Prisma (Product table)
            ↓
        Roboflow SAM3 (generate cutout)
            ↓
        Supabase Storage (cutoutImageUrl)
```
**Data:** Product URL → Scraped data → AI cutout → Database

---

## 9. COMPLIANCE GAPS & RISKS

### 9.1 Critical Issues (Immediate Action Required)

#### 🔴 CRITICAL 1: No Legal Agreements
- **Issue:** No Terms of Service, Privacy Policy, or Cookie Policy
- **Risk:** Cannot legally operate; users have not consented to data collection
- **GDPR Impact:** Article 13 requires privacy notice at data collection
- **CCPA Impact:** California law requires privacy policy
- **Action:** Draft and publish legal documents IMMEDIATELY

#### 🔴 CRITICAL 2: No User Consent for AI Processing
- **Issue:** User content sent to Anthropic, OpenAI without explicit consent
- **Risk:** GDPR Article 22 (automated decision-making), potential IP violations
- **Data Sent:**
  - Images to Anthropic for classification
  - Interview text to OpenAI for editorial generation
  - Product images to Roboflow
- **Action:** Add consent checkbox for AI features, update ToS

#### 🔴 CRITICAL 3: No Data Export/Deletion
- **Issue:** No user-facing account deletion or data export
- **GDPR Impact:** Article 17 (Right to Erasure), Article 20 (Data Portability)
- **CCPA Impact:** Right to deletion and access
- **Action:** Implement `/api/user/export` and `/api/user/delete`

#### 🔴 CRITICAL 4: EXIF Metadata Exposure
- **Issue:** Images uploaded with GPS coordinates, timestamps intact
- **Risk:** Location tracking, stalking, privacy invasion
- **Example:** Interior photos may reveal home address via GPS
- **Action:** Strip EXIF data on upload using Sharp library

#### 🔴 CRITICAL 5: No Cookie Consent
- **Issue:** Authentication cookies set without user consent
- **GDPR Impact:** ePrivacy Directive requires consent for all cookies
- **Action:** Implement cookie consent banner, cookie policy

### 9.2 High-Risk Issues

#### 🟠 HIGH 1: Unencrypted Trade Credentials
- **Issue:** `VendorTradeAccount` stores passwords in database
- **Current:** No encryption in schema
- **Comment:** Code says "Encrypted in practice via application layer"
- **Evidence:** ❌ No encryption code found
- **Action:** Implement field-level encryption (AES-256)

#### 🟠 HIGH 2: Public Storage Buckets
- **Issue:** Project images, quotes, spec sheets in public buckets
- **Risk:** Anyone with URL can access private project data
- **Action:** Move to private buckets, implement signed URLs

#### 🟠 HIGH 3: No Data Retention Policy
- **Issue:** Data stored indefinitely
- **Risk:** GDPR Article 5 requires storage limitation
- **Action:** Define retention periods, implement automated deletion

#### 🟠 HIGH 4: Debug Logging in Production
- **Issue:** Auth code logs emails, user IDs to console
- **File:** `src/app/api/auth/[...nextauth]/options.ts:70-75, 118-123`
- **Risk:** PII leakage to server logs, CloudWatch, etc.
- **Action:** Remove or gate with `if (process.env.NODE_ENV !== 'production')`

#### 🟠 HIGH 5: No Rate Limiting
- **Issue:** No brute force protection on login, signup
- **Risk:** Password enumeration, DDoS
- **Action:** Implement rate limiting (e.g., `express-rate-limit`, Vercel rate limits)

### 9.3 Medium-Risk Issues

#### 🟡 MEDIUM 1: No Content Security Policy
- **Issue:** No CSP headers
- **Risk:** XSS vulnerabilities harder to mitigate
- **Action:** Add CSP headers in `next.config.js`

#### 🟡 MEDIUM 2: Inconsistent API Authentication
- **Issue:** Some API routes lack session checks
- **Risk:** Unauthorized access to data
- **Action:** Audit all `/api/*` routes, add auth middleware

#### 🟡 MEDIUM 3: No MFA (Multi-Factor Authentication)
- **Issue:** Password-only authentication
- **Risk:** Account takeover if passwords leaked
- **Action:** Implement TOTP or SMS-based MFA

#### 🟡 MEDIUM 4: No Email Verification
- **Issue:** No email confirmation on signup
- **Risk:** Fake accounts, spam
- **Action:** Send verification email, gate features until confirmed

#### 🟡 MEDIUM 5: No Security Headers
- **Issue:** Missing X-Frame-Options, X-Content-Type-Options, etc.
- **Risk:** Clickjacking, MIME sniffing attacks
- **Action:** Add security headers

### 9.4 Low-Risk Issues

#### 🟢 LOW 1: No Copyright Notices
- **Issue:** No © Folio 2026 in footer
- **Action:** Add copyright notice to layout

#### 🟢 LOW 2: No Accessibility Statement
- **Issue:** No WCAG compliance statement
- **Action:** Add accessibility page

### 9.5 GDPR-Specific Gaps

| Requirement | Status | Evidence | Action |
|-------------|--------|----------|--------|
| **Article 6:** Lawful Basis | ❌ Missing | No consent or ToS | Define lawful basis (consent, contract, legitimate interest) |
| **Article 7:** Consent | ❌ Missing | No consent checkboxes | Add consent for AI, marketing, analytics |
| **Article 12:** Transparency | ❌ Missing | No privacy policy | Draft and publish privacy policy |
| **Article 13:** Data Notice | ❌ Missing | No notice at collection | Add privacy notice to signup flow |
| **Article 15:** Right to Access | ❌ Missing | No data export | Implement `/api/user/export` |
| **Article 16:** Right to Rectification | ⚠️ Partial | Profile editing exists | Test and document |
| **Article 17:** Right to Erasure | ❌ Missing | No deletion endpoint | Implement account deletion |
| **Article 20:** Data Portability | ❌ Missing | No structured export | Provide JSON/CSV export |
| **Article 25:** Privacy by Design | ⚠️ Partial | Some security measures | Audit and improve |
| **Article 32:** Security | ⚠️ Partial | bcrypt, httpOnly cookies | Add encryption, rate limiting |
| **Article 33:** Breach Notification | ❌ Missing | No incident plan | Create data breach response plan |

### 9.6 CCPA-Specific Gaps

| Requirement | Status | Action |
|-------------|--------|--------|
| **Privacy Policy** | ❌ Missing | Draft CCPA-compliant policy |
| **"Do Not Sell My Info"** | ❌ Missing | Add opt-out link (even if not selling) |
| **Right to Know** | ❌ Missing | Implement data disclosure API |
| **Right to Delete** | ❌ Missing | Implement account deletion |
| **Right to Opt-Out** | ❌ Missing | Add preference center |
| **Notice at Collection** | ❌ Missing | Disclose data collection at signup |

---

## 10. API ROUTES INVENTORY

### Overview
- **Total Routes:** 100+ API endpoints
- **Authentication:** Inconsistent (some protected, some open)
- **Rate Limiting:** None detected
- **Input Validation:** Partial (Zod used in some routes)

### High-Risk Routes (PII Exposure)

#### User Management
| Route | Method | Auth | Data Accepted | Data Returned | Notes |
|-------|--------|------|---------------|---------------|-------|
| `/api/auth/signup` | POST | None | email, password, name, role | User object (minus password) | ⚠️ No rate limiting |
| `/api/auth/[...nextauth]` | POST | None | credentials | JWT token | ⚠️ No rate limiting |
| `/api/auth/me` | GET | Required | - | Full user profile | ✅ Protected |
| `/api/auth/me/orgs/[membershipId]` | PATCH | Required | Updates | Organization membership | ⚠️ Audit permissions |
| `/api/designer/profile` | GET/PATCH | Required | Profile updates | Designer profile | ✅ Protected |

#### Project Data
| Route | Method | Auth | Data Accepted | Data Returned | Notes |
|-------|--------|------|---------------|---------------|-------|
| `/api/projects` | GET | Required | - | User's projects | ✅ Protected |
| `/api/projects/[id]` | GET | Required | - | Project details | ⚠️ Check ownership |
| `/api/projects/[id]/images` | POST | Required | Image file | Image URL | ⚠️ No EXIF stripping |
| `/api/projects/[id]/export` | GET | Required | - | Project export (Excel/PDF) | ✅ Good |

#### Interview Data (Sensitive)
| Route | Method | Auth | Data Accepted | Data Returned | Notes |
|-------|--------|------|---------------|---------------|-------|
| `/api/posting/project/[projectId]/interview` | POST | Required | Interview answers | Saved answers | 🔴 Sent to OpenAI |
| `/api/posting/project/[projectId]/interview/generate` | POST | Required | - | AI-generated editorial | 🔴 Uses OpenAI |
| `/api/posting/project/[projectId]/interview/transcribe` | POST | Required | Audio file | Transcribed text | ⚠️ Audio storage? |

#### Admin Routes (Highly Sensitive)
| Route | Method | Auth | Data Accepted | Data Returned | Notes |
|-------|--------|------|---------------|---------------|-------|
| `/api/admin/users` | GET | Admin | - | All users | 🔴 Full PII exposure |
| `/api/admin/users/[id]/approve` | POST | Admin | - | Approval status | ✅ Audit logged |
| `/api/admin/impersonate/[id]` | POST | Admin | - | Impersonation session | 🔴 Requires audit trail |
| `/api/admin/commerce/treasury` | GET | Admin | - | Financial data | 🔴 Highly sensitive |
| `/api/admin/commerce/trade-accounts` | POST | Admin | Trade credentials | Account ID | 🔴 Credentials handling |

#### Vendor Analytics (Business-Sensitive)
| Route | Method | Auth | Data Accepted | Data Returned | Notes |
|-------|--------|------|---------------|---------------|-------|
| `/api/vendor/analytics` | GET | Vendor | - | Analytics data | ✅ Protected |
| `/api/vendor/ai-analyst` | POST | Vendor | Query | AI insights | ⚠️ Uses OpenAI? |
| `/api/vendor/projects/[id]` | GET | Vendor | - | Project details | ⚠️ Check permissions |

### Authentication Requirements by Route Pattern

| Pattern | Auth Required | Notes |
|---------|---------------|-------|
| `/api/auth/*` | Mixed | Login/signup are public, `/me` protected |
| `/api/admin/*` | ✅ Admin only | ⚠️ Verify role check in all routes |
| `/api/designer/*` | ✅ Designer role | ⚠️ Some may allow ADMIN |
| `/api/vendor/*` | ✅ Vendor role | ⚠️ Some may allow ADMIN |
| `/api/projects/*` | ✅ Authenticated | ⚠️ Verify ownership checks |
| `/api/search/*` | ⚠️ Mixed | Some public, some protected |
| `/api/debug/*` | ❌ Open | 🔴 REMOVE IN PRODUCTION |

### Missing Protections

1. **No Global Auth Middleware:** Each route implements own auth
2. **No Rate Limiting:** Vulnerable to brute force, DDoS
3. **Inconsistent Ownership Checks:** Some routes may allow cross-user access
4. **Debug Routes in Production:** `/api/debug/*` routes exist
5. **No Request Logging:** No audit trail for sensitive operations

---

## 11. SEPARATION: DIY vs. LEGAL COUNSEL

### ✅ CAN IMPLEMENT INTERNALLY (Technical Fixes)

#### Immediate (This Week)
1. **Add Security Headers**
   - File: `next.config.js`
   - Add: X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy
   - Effort: 1-2 hours

2. **Strip EXIF Metadata**
   - File: `src/lib/storage.ts`
   - Use Sharp library to remove GPS, timestamps
   - Effort: 2-3 hours

3. **Remove Debug Logging**
   - Files: Auth options, various API routes
   - Gate with `process.env.NODE_ENV !== 'production'`
   - Effort: 1 hour

4. **Implement Rate Limiting**
   - Add middleware for `/api/auth/*`
   - Use `@upstash/ratelimit` or Vercel rate limits
   - Effort: 4-6 hours

5. **Remove Debug Routes**
   - Delete `/api/debug/*` or gate with environment check
   - Effort: 30 minutes

#### Short-Term (This Month)
6. **Account Deletion Endpoint**
   - Create `/api/user/delete`
   - Cascade delete related records
   - Effort: 8-12 hours (complex)

7. **Data Export Endpoint**
   - Create `/api/user/export`
   - Return JSON/CSV of user's data
   - Effort: 6-8 hours

8. **Encrypt Trade Credentials**
   - Use `crypto` module (AES-256-GCM)
   - Encrypt before storing in `VendorTradeAccount`
   - Effort: 8-12 hours

9. **Private Storage Buckets**
   - Migrate to private Supabase buckets
   - Implement signed URLs (expiring links)
   - Effort: 12-16 hours

10. **Email Verification**
    - Send confirmation email on signup
    - Gate features until verified
    - Effort: 8-12 hours

11. **Add Copyright Notices**
    - Footer: © 2026 Folio, Inc.
    - Effort: 30 minutes

12. **Cookie Consent Banner**
    - Use library like `react-cookie-consent`
    - Link to cookie policy
    - Effort: 4-6 hours

#### Medium-Term (Next Quarter)
13. **Audit All API Routes**
    - Verify authentication on every route
    - Add ownership checks where needed
    - Effort: 16-24 hours

14. **Implement MFA**
    - Add TOTP (Google Authenticator)
    - Optional for users, required for admins
    - Effort: 24-32 hours

15. **Data Retention Policy (Technical)**
    - Automated deletion of old records
    - Archive inactive accounts
    - Effort: 16-24 hours

16. **Request Logging & Audit Trail**
    - Log sensitive operations (admin actions, deletions)
    - Store in separate audit table
    - Effort: 12-16 hours

---

### ⚖️ REQUIRES LEGAL COUNSEL (Legal Documents & Strategy)

#### Immediate (This Week)
1. **Draft Privacy Policy**
   - GDPR and CCPA compliant
   - Disclose all data collection practices
   - Explain AI usage, third-party sharing
   - Detail user rights (access, deletion, portability)
   - **Why Legal:** Complex regulatory requirements, liability

2. **Draft Terms of Service**
   - User agreement and platform rules
   - Content licensing (who owns what)
   - AI processing consent
   - Limitation of liability
   - Dispute resolution (arbitration clause?)
   - **Why Legal:** Enforceable contract, litigation risk

3. **Draft Cookie Policy**
   - List all cookies used
   - Purpose and duration
   - Third-party cookies (if any in future)
   - **Why Legal:** GDPR ePrivacy Directive compliance

#### Short-Term (This Month)
4. **Review AI Provider Agreements**
   - Anthropic terms for Claude API
   - OpenAI terms for GPT, DALL-E, Embeddings
   - Stability AI, Roboflow terms
   - **Questions:**
     - Is user data used for training?
     - Data residency and security
     - Compliance with GDPR/CCPA
   - **Why Legal:** Third-party liability, data processing agreements

5. **Data Processing Agreement (DPA) with Supabase**
   - GDPR Article 28 requirement
   - Supabase as data processor
   - Data residency confirmation
   - **Why Legal:** Required for GDPR compliance

6. **Consent Mechanism Design**
   - Granular consent for AI features
   - Opt-in for marketing, analytics
   - Withdrawal of consent
   - **Why Legal:** GDPR consent must be "freely given, specific, informed, unambiguous"

7. **Content Licensing Strategy**
   - Define rights: Folio vs. Designers vs. Vendors
   - Can Folio use project photos for marketing?
   - Who owns AI-generated editorial content?
   - Attribution requirements
   - **Why Legal:** IP ownership, potential disputes

#### Medium-Term (Next Quarter)
8. **Data Breach Response Plan**
   - GDPR Article 33: 72-hour notification
   - Incident response team
   - User notification templates
   - Regulatory notification procedures
   - **Why Legal:** Regulatory compliance, crisis management

9. **CCPA Compliance Audit**
   - "Do Not Sell My Personal Information" (even if not selling)
   - California-specific disclosures
   - Authorized agent requests
   - **Why Legal:** State-specific regulations

10. **Vendor Agreements Review**
    - Contracts with vendors using platform
    - Liability for product quality, accuracy
    - Commission structures (Order/Credit system)
    - **Why Legal:** Business relationships, liability

11. **Accessibility Compliance (WCAG 2.1 AA)**
    - Legal requirement in some jurisdictions
    - ADA compliance (US)
    - **Why Legal:** Accessibility lawsuits common

12. **Export Control & International Data Transfers**
    - Standard Contractual Clauses (SCCs) for EU data
    - Privacy Shield alternative
    - China/Russia data localization laws (if expanding)
    - **Why Legal:** Cross-border data transfers

---

## 12. RECOMMENDATIONS SUMMARY

### Immediate Actions (This Week)

#### Technical (DIY)
- [ ] Add security headers to `next.config.js`
- [ ] Strip EXIF metadata on image upload
- [ ] Remove debug logging in production
- [ ] Delete or gate `/api/debug/*` routes
- [ ] Add rate limiting to auth endpoints

#### Legal (Counsel Required)
- [ ] Draft Privacy Policy (GDPR + CCPA)
- [ ] Draft Terms of Service
- [ ] Draft Cookie Policy
- [ ] Publish legal pages: `/privacy`, `/terms`, `/cookies`
- [ ] Add consent checkbox to signup flow

### Short-Term (This Month)

#### Technical (DIY)
- [ ] Implement account deletion API
- [ ] Implement data export API
- [ ] Encrypt trade credentials in database
- [ ] Add email verification
- [ ] Cookie consent banner

#### Legal (Counsel Required)
- [ ] Review AI provider terms (Anthropic, OpenAI, Stability, Roboflow)
- [ ] Sign DPA with Supabase
- [ ] Define content licensing model
- [ ] Design consent mechanism for AI features

### Medium-Term (Next Quarter)

#### Technical (DIY)
- [ ] Audit all API routes for auth/permissions
- [ ] Implement MFA (optional for users, required for admins)
- [ ] Migrate to private storage buckets (signed URLs)
- [ ] Data retention automation
- [ ] Request logging and audit trail

#### Legal (Counsel Required)
- [ ] Data breach response plan
- [ ] CCPA compliance audit
- [ ] Vendor contract templates
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [ ] International data transfer agreements (SCCs)

### Long-Term (Next Year)

#### Technical (DIY)
- [ ] Security audit (penetration testing)
- [ ] SOC 2 Type II certification (if pursuing enterprise clients)
- [ ] Implement ISO 27001 controls

#### Legal (Counsel Required)
- [ ] Annual privacy policy review
- [ ] Regulatory compliance monitoring (new laws)
- [ ] User rights request handling (access, deletion, portability)

---

## 13. APPENDICES

### Appendix A: Environment Variables Inventory

**Required Secrets:**
```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Authentication
NEXTAUTH_SECRET=... (MUST be random, not 'your-secret-key')
NEXTAUTH_URL=https://yourdomain.com

# AI Providers
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
STABILITY_API_KEY=... (optional)
GOOGLE_API_KEY=... (optional, not currently used)

# Image Processing
ROBOFLOW_API_KEY=...

# Scraping
BROWSERLESS_API_KEY=... (optional)

# Feature Flags (optional)
OPENAI_ENABLED=true
IMAGE_GEN_PROVIDER=openai
FAKE_PROVIDER=0
```

### Appendix B: Data Subject Rights Implementation Guide

**GDPR Article 15: Right to Access**
```typescript
// GET /api/user/export
// Return JSON with:
{
  "user": { ...user profile... },
  "projects": [ ...all projects... ],
  "images": [ ...all uploaded images... ],
  "interviews": [ ...interview answers... ],
  "orders": [ ...purchase history... ],
  "behavioral_data": {
    "context_signals": [ ...tracking data... ],
    "atelier_signals": [ ...fingerprinting data... ]
  },
  "ai_data": {
    "voice_profile": { ...voice analysis... },
    "aesthetic_profile": { ...style preferences... }
  }
}
```

**GDPR Article 17: Right to Erasure**
```typescript
// DELETE /api/user/delete
// Steps:
1. Soft delete user (accountStatus = 'DELETED')
2. Anonymize PII (email → 'deleted-{uuid}', name → 'Deleted User')
3. Cascade delete:
   - Personal projects (if unpublished)
   - Interview answers
   - RSVP records
   - Context signals
4. Orphan published projects (keep but anonymize creator)
5. Log deletion request (audit trail)
6. Notify user via email (confirmation)
```

### Appendix C: AI Data Usage Audit

**Content Sent to Third-Party AI:**

| AI Provider | Content Type | User Identifiable? | Purpose | Training Risk |
|-------------|--------------|-------------------|---------|---------------|
| Anthropic Claude | Project images (URLs) | ⚠️ Possible (faces, locations) | Image classification | Low (API default: no training) |
| OpenAI GPT | Interview text | ✅ Yes (name, design philosophy) | Editorial generation | Low (API default: no training) |
| OpenAI DALL-E | Room descriptions | ❌ No | Image generation | Low |
| OpenAI Embeddings | Text snippets | ⚠️ Possible (product names) | Search indexing | Low |
| Roboflow SAM3 | Product images | ❌ No | Background removal | Unknown (verify policy) |

**Recommendation:**
- Add clause to Privacy Policy: "We use AI services to enhance your experience. Your content may be processed by third-party AI providers (Anthropic, OpenAI, Roboflow) but is not used to train their models."
- Link to AI provider privacy policies

### Appendix D: Supabase Storage Audit

**Current Buckets:**
- `event-images` (public) - Event photos, designer uploads
- `project-assets` (public) - Project images, generated content

**Files Stored:**
- User-uploaded photos (EXIF intact ⚠️)
- AI-generated images
- Product cutouts (AI-generated)
- 3D meshes (GLB files)
- Spec sheets, quotes (PDFs)

**Access Control:**
- Public URLs (no authentication)
- Permanent links (no expiration)

**Recommendations:**
1. Migrate to private buckets
2. Use signed URLs with 7-day expiration
3. Strip EXIF before upload
4. Implement access logging

### Appendix E: Contact Information

**For Legal Questions:**
- Include contact email in Privacy Policy (e.g., legal@folio.com, privacy@folio.com)
- DPO (Data Protection Officer) if required by GDPR (businesses with >250 employees or high-risk processing)

**For User Rights Requests:**
- Privacy request form: `/privacy-request`
- Email: privacy@folio.com

---

## CONCLUSION

This audit reveals a sophisticated platform with significant data collection and AI integration. While technical security measures (bcrypt, httpOnly cookies) are solid, **critical legal compliance gaps exist**:

1. ❌ No Terms of Service or Privacy Policy
2. ❌ No consent for AI processing
3. ❌ No data deletion mechanism
4. ❌ EXIF metadata exposure
5. ❌ Trade credentials unencrypted

**Immediate Priority:**
Engage legal counsel to draft Privacy Policy, Terms of Service, and Cookie Policy. Without these, platform cannot legally operate, especially for EU users.

**Technical Priority:**
Strip EXIF metadata, add security headers, remove debug logging, implement rate limiting.

**Timeline:**
- Legal documents: 1-2 weeks (with counsel)
- Technical fixes: 2-4 weeks (internal dev)
- Full compliance: 2-3 months

---

**Document Prepared By:** AI Legal Audit System
**Review Required:** ✅ Legal Counsel, ✅ Engineering Team, ✅ Product Leadership
**Next Steps:** Schedule legal consultation, prioritize technical backlog
