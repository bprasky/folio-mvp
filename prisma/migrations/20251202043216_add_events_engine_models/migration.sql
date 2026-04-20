-- Events engine: host profiles, contacts, invite lists, invites, targeting profiles,
-- engagement metrics, and five edge tables (designer/vendor/rep/product/relationship).
-- Authored from prod introspection of 11 event_* tables + InviteRole enum; idempotent.

DO $$ BEGIN
    CREATE TYPE "InviteRole" AS ENUM ('HOST', 'CO_HOST', 'FEATURED_GUEST', 'SPONSOR', 'ATTENDEE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ================================================================
-- Host profile — root of the events engine (one per hosting user)
-- ================================================================
CREATE TABLE IF NOT EXISTS "event_host_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "hostEmail" TEXT NOT NULL,
    "hostPhone" TEXT,
    "hostCompany" TEXT,
    "hostTitle" TEXT,
    "hostBio" TEXT,
    "hostImageUrl" TEXT,
    "preferredContactMethod" TEXT,
    "autoFollowEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recapEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "totalEventsHosted" INTEGER NOT NULL DEFAULT 0,
    "totalInvitesSent" INTEGER NOT NULL DEFAULT 0,
    "totalAttendees" INTEGER NOT NULL DEFAULT 0,
    "averageAttendanceRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_host_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_host_profiles_userId_key" ON "event_host_profiles"("userId");
CREATE INDEX IF NOT EXISTS "event_host_profiles_userId_idx" ON "event_host_profiles"("userId");

-- ================================================================
-- Host contact book — one row per person this host has in their list
-- ================================================================
CREATE TABLE IF NOT EXISTS "event_contacts" (
    "id" TEXT NOT NULL,
    "hostProfileId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "title" TEXT,
    "role" TEXT,
    "userId" TEXT,
    "totalInvitesReceived" INTEGER NOT NULL DEFAULT 0,
    "totalEventsAttended" INTEGER NOT NULL DEFAULT 0,
    "lastInvitedAt" TIMESTAMP,
    "lastAttendedAt" TIMESTAMP,
    "lastEngagedAt" TIMESTAMP,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_contacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_contacts_hostProfileId_email_key" ON "event_contacts"("hostProfileId", "email");
CREATE INDEX IF NOT EXISTS "event_contacts_hostProfileId_idx" ON "event_contacts"("hostProfileId");
CREATE INDEX IF NOT EXISTS "event_contacts_email_idx" ON "event_contacts"("email");
CREATE INDEX IF NOT EXISTS "event_contacts_userId_idx" ON "event_contacts"("userId");

-- ================================================================
-- Reusable invite lists owned by a host profile
-- ================================================================
CREATE TABLE IF NOT EXISTS "event_invite_lists" (
    "id" TEXT NOT NULL,
    "hostProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "listType" TEXT NOT NULL DEFAULT 'manual',
    "contactIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetingCriteria" JSONB,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "priceUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_invite_lists_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "event_invite_lists_hostProfileId_idx" ON "event_invite_lists"("hostProfileId");
CREATE INDEX IF NOT EXISTS "event_invite_lists_listType_idx" ON "event_invite_lists"("listType");

-- ================================================================
-- Per-event invite row (user or email) with InviteRole
-- ================================================================
CREATE TABLE IF NOT EXISTS "event_invites" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "role" "InviteRole" NOT NULL DEFAULT 'ATTENDEE',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "event_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_invites_eventId_email_unique" ON "event_invites"("eventId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "event_invites_eventId_userId_unique" ON "event_invites"("eventId", "userId");
CREATE INDEX IF NOT EXISTS "event_invites_eventId_idx" ON "event_invites"("eventId");
CREATE INDEX IF NOT EXISTS "event_invites_userId_idx" ON "event_invites"("userId");
CREATE INDEX IF NOT EXISTS "event_invites_email_idx" ON "event_invites"("email");

-- ================================================================
-- Targeting profile per host — discovery criteria for invite lists
-- ================================================================
CREATE TABLE IF NOT EXISTS "event_targeting_profiles" (
    "id" TEXT NOT NULL,
    "hostProfileId" TEXT NOT NULL,
    "targetRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetSpecialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetBudgetRanges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetProjectStages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minEngagementScore" DOUBLE PRECISION,
    "minProximityScore" DOUBLE PRECISION,
    "aiPreferences" JSONB,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_targeting_profiles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "event_targeting_profiles_hostProfileId_idx" ON "event_targeting_profiles"("hostProfileId");

-- ================================================================
-- Per-event aggregate metrics (one-to-one with event)
-- ================================================================
CREATE TABLE IF NOT EXISTS "event_engagement_metrics" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "totalInvites" INTEGER NOT NULL DEFAULT 0,
    "totalRSVPs" INTEGER NOT NULL DEFAULT 0,
    "totalAttendees" INTEGER NOT NULL DEFAULT 0,
    "totalEngagements" INTEGER NOT NULL DEFAULT 0,
    "designerInvites" INTEGER NOT NULL DEFAULT 0,
    "designerRSVPs" INTEGER NOT NULL DEFAULT 0,
    "designerAttendees" INTEGER NOT NULL DEFAULT 0,
    "vendorInvites" INTEGER NOT NULL DEFAULT 0,
    "vendorRSVPs" INTEGER NOT NULL DEFAULT 0,
    "vendorAttendees" INTEGER NOT NULL DEFAULT 0,
    "productViews" INTEGER NOT NULL DEFAULT 0,
    "productSaves" INTEGER NOT NULL DEFAULT 0,
    "productClicks" INTEGER NOT NULL DEFAULT 0,
    "repConnections" INTEGER NOT NULL DEFAULT 0,
    "repQuotes" INTEGER NOT NULL DEFAULT 0,
    "estimatedRevenue" DOUBLE PRECISION,
    "actualRevenue" DOUBLE PRECISION,
    "lastUpdatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_engagement_metrics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_engagement_metrics_eventId_key" ON "event_engagement_metrics"("eventId");
CREATE INDEX IF NOT EXISTS "event_engagement_metrics_eventId_idx" ON "event_engagement_metrics"("eventId");

-- ================================================================
-- Edge tables — event × (designer | vendor | rep | product) + relationship graph
-- ================================================================
CREATE TABLE IF NOT EXISTS "event_designer_edges" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_designer_edges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_designer_edges_eventId_designerId_key" ON "event_designer_edges"("eventId", "designerId");
CREATE INDEX IF NOT EXISTS "event_designer_edges_eventId_idx" ON "event_designer_edges"("eventId");
CREATE INDEX IF NOT EXISTS "event_designer_edges_designerId_idx" ON "event_designer_edges"("designerId");
CREATE INDEX IF NOT EXISTS "event_designer_edges_edgeType_idx" ON "event_designer_edges"("edgeType");

CREATE TABLE IF NOT EXISTS "event_vendor_edges" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "productViews" INTEGER NOT NULL DEFAULT 0,
    "productSaves" INTEGER NOT NULL DEFAULT 0,
    "repEngagements" INTEGER NOT NULL DEFAULT 0,
    "estimatedROI" DOUBLE PRECISION,
    "actualROI" DOUBLE PRECISION,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_vendor_edges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_vendor_edges_eventId_vendorId_key" ON "event_vendor_edges"("eventId", "vendorId");
CREATE INDEX IF NOT EXISTS "event_vendor_edges_eventId_idx" ON "event_vendor_edges"("eventId");
CREATE INDEX IF NOT EXISTS "event_vendor_edges_vendorId_idx" ON "event_vendor_edges"("vendorId");
CREATE INDEX IF NOT EXISTS "event_vendor_edges_edgeType_idx" ON "event_vendor_edges"("edgeType");

CREATE TABLE IF NOT EXISTS "event_rep_edges" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "repId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "connectionsMade" INTEGER NOT NULL DEFAULT 0,
    "productsPresented" INTEGER NOT NULL DEFAULT 0,
    "quotesSent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_rep_edges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_rep_edges_eventId_repId_key" ON "event_rep_edges"("eventId", "repId");
CREATE INDEX IF NOT EXISTS "event_rep_edges_eventId_idx" ON "event_rep_edges"("eventId");
CREATE INDEX IF NOT EXISTS "event_rep_edges_repId_idx" ON "event_rep_edges"("repId");
CREATE INDEX IF NOT EXISTS "event_rep_edges_edgeType_idx" ON "event_rep_edges"("edgeType");

CREATE TABLE IF NOT EXISTS "event_product_edges" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION,
    "lastSpikeAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_product_edges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_product_edges_eventId_productId_key" ON "event_product_edges"("eventId", "productId");
CREATE INDEX IF NOT EXISTS "event_product_edges_eventId_idx" ON "event_product_edges"("eventId");
CREATE INDEX IF NOT EXISTS "event_product_edges_productId_idx" ON "event_product_edges"("productId");
CREATE INDEX IF NOT EXISTS "event_product_edges_edgeType_idx" ON "event_product_edges"("edgeType");

CREATE TABLE IF NOT EXISTS "event_relationship_edges" (
    "id" TEXT NOT NULL,
    "hostProfileId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "decayAt" TIMESTAMP,
    "eventId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_relationship_edges_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "event_relationship_edges_hostProfileId_idx" ON "event_relationship_edges"("hostProfileId");
CREATE INDEX IF NOT EXISTS "event_relationship_edges_eventId_idx" ON "event_relationship_edges"("eventId");
CREATE INDEX IF NOT EXISTS "event_relationship_edges_relationshipType_idx" ON "event_relationship_edges"("relationshipType");
CREATE INDEX IF NOT EXISTS "event_relationship_edges_sourceType_sourceId_idx" ON "event_relationship_edges"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "event_relationship_edges_targetType_targetId_idx" ON "event_relationship_edges"("targetType", "targetId");

-- ================================================================
-- Foreign keys (all wrapped in conname-existence guards)
-- ================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_host_profiles_userId_fkey') THEN
        ALTER TABLE "event_host_profiles" ADD CONSTRAINT "event_host_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_contacts_hostProfileId_fkey') THEN
        ALTER TABLE "event_contacts" ADD CONSTRAINT "event_contacts_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "event_host_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_contacts_userId_fkey') THEN
        ALTER TABLE "event_contacts" ADD CONSTRAINT "event_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_invite_lists_hostProfileId_fkey') THEN
        ALTER TABLE "event_invite_lists" ADD CONSTRAINT "event_invite_lists_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "event_host_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_invites_eventId_fkey') THEN
        ALTER TABLE "event_invites" ADD CONSTRAINT "event_invites_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_invites_userId_fkey') THEN
        ALTER TABLE "event_invites" ADD CONSTRAINT "event_invites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_targeting_profiles_hostProfileId_fkey') THEN
        ALTER TABLE "event_targeting_profiles" ADD CONSTRAINT "event_targeting_profiles_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "event_host_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_engagement_metrics_eventId_fkey') THEN
        ALTER TABLE "event_engagement_metrics" ADD CONSTRAINT "event_engagement_metrics_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_designer_edges_eventId_fkey') THEN
        ALTER TABLE "event_designer_edges" ADD CONSTRAINT "event_designer_edges_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_designer_edges_designerId_fkey') THEN
        ALTER TABLE "event_designer_edges" ADD CONSTRAINT "event_designer_edges_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_vendor_edges_eventId_fkey') THEN
        ALTER TABLE "event_vendor_edges" ADD CONSTRAINT "event_vendor_edges_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_vendor_edges_vendorId_fkey') THEN
        ALTER TABLE "event_vendor_edges" ADD CONSTRAINT "event_vendor_edges_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_rep_edges_eventId_fkey') THEN
        ALTER TABLE "event_rep_edges" ADD CONSTRAINT "event_rep_edges_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_rep_edges_repId_fkey') THEN
        ALTER TABLE "event_rep_edges" ADD CONSTRAINT "event_rep_edges_repId_fkey" FOREIGN KEY ("repId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_product_edges_eventId_fkey') THEN
        ALTER TABLE "event_product_edges" ADD CONSTRAINT "event_product_edges_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_product_edges_productId_fkey') THEN
        ALTER TABLE "event_product_edges" ADD CONSTRAINT "event_product_edges_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_relationship_edges_hostProfileId_fkey') THEN
        ALTER TABLE "event_relationship_edges" ADD CONSTRAINT "event_relationship_edges_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "event_host_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_relationship_edges_eventId_fkey') THEN
        ALTER TABLE "event_relationship_edges" ADD CONSTRAINT "event_relationship_edges_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
