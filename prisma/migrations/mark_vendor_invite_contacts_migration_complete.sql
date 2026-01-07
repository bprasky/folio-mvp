-- Mark Vendor Invite Contacts migration as complete in Prisma migrations table
-- Run this AFTER running the add_vendor_invite_contacts.sql file

INSERT INTO "_prisma_migrations" (
  "id",
  "checksum",
  "finished_at",
  "migration_name",
  "logs",
  "rolled_back_at",
  "started_at",
  "applied_steps_count"
)
SELECT 
  gen_random_uuid(),
  '',
  NOW(),
  '20250130000001_add_vendor_invite_contacts',
  NULL,
  NULL,
  NOW(),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" 
  WHERE "migration_name" = '20250130000001_add_vendor_invite_contacts'
);

-- Verify the migration was recorded:
-- SELECT * FROM "_prisma_migrations" WHERE "migration_name" LIKE '%vendor_invite_contacts%';








