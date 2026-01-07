# Recorded Reflection System Migration

## Files
- `add_recorded_reflection_system.sql` - Main migration SQL
- `mark_recorded_reflection_system_migration_complete.sql` - Mark migration as complete in Prisma

## Steps to Apply

### 1. Run the Migration SQL
```bash
# Connect to your database and run:
psql $DATABASE_URL -f prisma/migrations/add_recorded_reflection_system.sql

# Or using Supabase CLI:
supabase db execute -f prisma/migrations/add_recorded_reflection_system.sql
```

### 2. Mark Migration as Complete
```bash
# Run the mark complete SQL:
psql $DATABASE_URL -f prisma/migrations/mark_recorded_reflection_system_migration_complete.sql

# Or using Supabase CLI:
supabase db execute -f prisma/migrations/mark_recorded_reflection_system_migration_complete.sql
```

### 3. Regenerate Prisma Client
```bash
npx prisma generate
```

## What Gets Created

### Enums
- `InterviewSessionStatus` - Status workflow enum
- `InterviewMode` - AUDIO | VIDEO
- `QuoteUseCase` - Where quotes appear
- `VendorBoostRequestStatus` - Request workflow enum

### Tables
- `media_assets` - Audio/video file storage metadata
- `interview_sessions` - Main interview container
- `interview_questions` - Questions asked during interview
- `transcript_segments` - Timestamped transcript chunks
- `quote_highlights` - Extracted quotes with approval workflow
- `vendor_boost_requests` - Vendor requests for designer insights

### Relations Added
- InterviewSession → User (createdBy)
- InterviewSession → Project (optional)
- InterviewSession → Product (optional)
- InterviewSession → Vendor (optional)
- InterviewSession → VendorBoostRequest (optional)
- InterviewSession → MediaAsset (recording)
- InterviewQuestion → InterviewSession
- TranscriptSegment → InterviewSession
- QuoteHighlight → InterviewSession
- QuoteHighlight → Product (optional)
- VendorBoostRequest → Vendor
- VendorBoostRequest → Product
- VendorBoostRequest → Project
- VendorBoostRequest → User (requestedDesigner)
- VendorBoostRequest → InterviewSession (optional)

## Verification

After running the migration, verify with:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'media_assets',
  'interview_sessions',
  'interview_questions',
  'transcript_segments',
  'quote_highlights',
  'vendor_boost_requests'
);

-- Check enums exist
SELECT typname FROM pg_type 
WHERE typname IN (
  'InterviewSessionStatus',
  'InterviewMode',
  'QuoteUseCase',
  'VendorBoostRequestStatus'
);

-- Check migration was recorded
SELECT * FROM "_prisma_migrations" 
WHERE "migration_name" LIKE '%recorded_reflection%';
```

## Rollback (if needed)

To rollback, you would need to:
1. Drop foreign keys
2. Drop tables
3. Drop enums
4. Remove migration record from `_prisma_migrations`

But this migration is additive only - no existing data is modified.




