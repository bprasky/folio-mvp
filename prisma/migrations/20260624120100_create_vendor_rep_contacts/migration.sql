-- Create the vendor_rep_contacts table. The VendorRepContact model exists in
-- schema.prisma (designers' vendor/brand rep contacts, used by the tagging and
-- rep-contact flows) but no migration ever created the table, so production
-- errors with "relation vendor_rep_contacts does not exist".
--
-- Idempotent: IF NOT EXISTS on the table and indexes, and the FK is added inside
-- a DO block that swallows duplicate_object, so re-running is a no-op. Column
-- types and the snake_case @@map / index names match the schema model.
CREATE TABLE IF NOT EXISTS "vendor_rep_contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repName" TEXT NOT NULL,
    "repEmail" TEXT,
    "repPhone" TEXT,
    "repTitle" TEXT,
    "vendorName" TEXT NOT NULL,
    "vendorOrgId" TEXT,
    "preferredContact" TEXT,
    "notes" TEXT,
    "hasTradeAccount" BOOLEAN NOT NULL DEFAULT false,
    "tradeAccountNumber" TEXT,
    "tradeDiscount" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastContactedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_rep_contacts_pkey" PRIMARY KEY ("id")
);

-- @@unique([userId, vendorName]): one rep per vendor per designer.
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_rep_contacts_userId_vendorName_key"
    ON "vendor_rep_contacts"("userId", "vendorName");
CREATE INDEX IF NOT EXISTS "vendor_rep_contacts_userId_idx"
    ON "vendor_rep_contacts"("userId");
CREATE INDEX IF NOT EXISTS "vendor_rep_contacts_vendorName_idx"
    ON "vendor_rep_contacts"("vendorName");

-- user User @relation(... onDelete: Cascade)
DO $$ BEGIN
  ALTER TABLE "vendor_rep_contacts"
    ADD CONSTRAINT "vendor_rep_contacts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
