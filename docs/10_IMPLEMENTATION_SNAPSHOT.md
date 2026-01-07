> ⚠️ Canonical Notice  
> This document reflects the current implemented state of the system based on a codebase audit.  
> It does not define future direction unless explicitly stated elsewhere.

# Implementation Snapshot

## Purpose

This document provides a snapshot of the current implemented state of the system, including technology stack, structure, and key features as observed in the codebase.

## Technology Stack

**Currently implemented:**

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma 6.18.0
- **Authentication**: NextAuth.js 4.24.11
- **Storage**: Supabase Storage
- **Styling**: Tailwind CSS 3.4.1
- **AI**: OpenAI (for article generation, embeddings)
- **3D Assets**: Roboflow SAM3 integration
- **Node Version**: >=18.0.0

**Key Dependencies Observed:**
- React 18.2.0
- @prisma/client 6.18.0
- next-auth 4.24.11
- openai 5.20.1
- @supabase/supabase-js 2.55.0
- zod 4.0.17 (validation)
- bcryptjs 3.0.2 (password hashing)
- framer-motion 12.23.21 (animations)

## Project Structure

**Main directories observed:**

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth routes
│   ├── admin/             # Admin panel
│   ├── api/               # API routes
│   ├── designer/          # Designer dashboard
│   ├── vendor/            # Vendor dashboard
│   ├── project/           # Project pages
│   ├── p/                 # Published posts
│   ├── events/            # Events pages
│   └── feed/              # Feed page
├── components/            # React components
├── lib/                   # Utilities and helpers
│   ├── ai/                # AI integrations
│   ├── auth/              # Authentication utilities
│   ├── editorial/         # Editorial system
│   ├── events/            # Events utilities
│   └── prisma.ts          # Prisma client
└── prisma/
    └── schema.prisma      # Database schema
```

## Database Schema

**Currently implemented models (from `prisma/schema.prisma`):**

**Core Models:**
- User (with roles, organizations, profiles)
- Organization (with types and users)
- Project (with stages, types, visibility)
- ProjectImage (with tags)
- Product (with vendor relations, 3D assets)
- ProductTag (image coordinates)
- Room, Selection, Quote
- Event, EventRSVP, EventInvite

**Editorial Models:**
- ProjectPost (published editorial content)
- EditorialDraft (draft editorial content)
- EditorialCategory (style/region/theme categories)
- EditorialAssignment (project-to-category mapping)
- EditorialEdition (curated collections)
- ProjectModule (flexible content modules)

**Advanced Models:**
- ProjectParticipant (collaboration access control)
- ContextSignal (user action tracking)
- GraphEdge, MarketSignal, SpendRecommendation (predictive market layer)
- AtelierFingerprint, AtelierNode, AtelierEdge (design fingerprint system)
- EventHostProfile, EventContact, EventInviteList (events engine)
- InterviewSession, TranscriptSegment, QuoteHighlight (recorded reflections)
- ThreeDAsset (3D asset pipeline)
- Vendor, VendorPreviewToken, VendorInviteCandidate

**Total**: 50+ models observed in schema

## API Routes

**Main API route categories observed:**

- `/api/auth/*` - Authentication (signup, signin, signout, me, callback)
- `/api/designer/*` - Designer operations (profile, projects, folders, posts)
- `/api/vendor/*` - Vendor operations (products, analytics, collaborations, boost)
- `/api/admin/*` - Admin operations (users, events, editorial review, atelier)
- `/api/events/*` - Events management (creation, RSVP, invites, workflow, graph, audience)
- `/api/projects/*` - Project CRUD, images, rooms, exports
- `/api/posting/*` - Editorial posting workflow
- `/api/products/*` - Product operations (search, save, insights)
- `/api/interviews/*` - Interview/recording workflow
- `/api/editorial-submissions/*` - Editorial submission system

**Total**: 200+ API route files observed

## User Roles

**Currently implemented (Role enum):**
- ADMIN
- VENDOR
- DESIGNER (default)
- HOMEOWNER
- GUEST
- INDIVIDUAL

## Main Features Implemented

**Project Management:**
- Project creation (quick create, detailed setup)
- Image upload and management
- Product tagging (x/y coordinates on images)
- Room organization
- Selection management
- Publishing workflow (draft → published)
- Project export (CSV, spec sheets)

**Editorial System:**
- Editorial draft generation (AI-powered)
- Interview workflow for content creation
- Editorial publishing (ProjectPost model)
- Editorial categorization (style/region/theme)
- Editorial editions (curated collections)
- Editorial scheduler (daily automation)

**Vendor Features:**
- Product creation (URL scraping, wizard)
- Vendor dashboard
- Vendor analytics
- Vendor boost requests (interview requests)
- Vendor collaborations (project-level)
- Vendor rep system
- Vendor invite candidates

**Events System:**
- Event creation and management
- RSVP system
- Event invites (manual, CSV, graph-based targeting)
- Events engine (host profiles, contacts, relationships)
- Event graph (designer/vendor/product/rep edges)
- Post-event workflows (recap, follow-ups, ROI)

**Collaboration:**
- Project participants (designer/vendor access control)
- Context signals (action tracking)
- Collaboration spend (budget tracking)
- Handoff workflow (vendor → designer)

**Advanced Features:**
- Atelier (design fingerprint system)
- Predictive market layer (signals, graph, embeddings)
- 3D asset generation (Roboflow SAM3)
- Instagram export
- Meeting notes and action items
- Interview sessions (audio/video recording workflow)

## Routes Structure

**Key public routes observed:**
- `/` - Homepage
- `/feed` - Main feed
- `/events` - Events listing
- `/designer` - Designer dashboard
- `/designer/profile` - Designer portfolio (published projects)
- `/vendor` - Vendor dashboard
- `/admin` - Admin panel
- `/project/[id]` - Project detail
- `/p/[slug]` - Published post
- `/product/[productId]` - Product page
- `/events/[id]` - Event detail

## Authentication

**Currently implemented:**
- NextAuth.js with credentials provider
- bcrypt password hashing
- JWT session strategy
- Case-insensitive email lookup
- Role hydration from database
- Session callbacks for user data

**Auth endpoints:**
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `GET /api/auth/me`
- `POST /api/auth/signout`

## Data Storage

**Database:**
- PostgreSQL via Supabase
- Prisma ORM for database access
- Migrations via Prisma

**File Storage:**
- Supabase Storage for media files
- Image URLs stored in database
- Support for 3D assets (GLB, USDZ formats)

## AI Integration

**Currently implemented:**
- OpenAI for editorial content generation
- OpenAI embeddings (text-embedding-3-large)
- AI-powered project understanding
- AI-generated insights and recommendations
- Interview transcription and quote extraction

## Development Scripts

**Key scripts observed (from package.json):**
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run migrate:safe` - Safe database migration
- `npm run jobs:embed` - Generate embeddings
- `npm run jobs:edges` - Build graph edges
- `npm run jobs:decay` - Apply edge decay



