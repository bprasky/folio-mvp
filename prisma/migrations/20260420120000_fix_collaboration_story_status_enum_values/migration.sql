-- Add missing CollaborationStoryStatus enum values declared in schema.prisma but absent in prod.
-- Authored 2026-04-20 as part of Phase 5B Bucket 1.
-- schema.prisma defines 18 values; prod has 15. The 3 missing values are terminal states used
-- by the collaboration-story pipeline (vendor approval gate, designer approval gate, archive).
-- Idempotent via ADD VALUE IF NOT EXISTS.

ALTER TYPE "CollaborationStoryStatus" ADD VALUE IF NOT EXISTS 'VENDOR_APPROVED';
ALTER TYPE "CollaborationStoryStatus" ADD VALUE IF NOT EXISTS 'DESIGNER_APPROVED';
ALTER TYPE "CollaborationStoryStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
