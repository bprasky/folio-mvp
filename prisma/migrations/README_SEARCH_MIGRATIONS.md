# Search Implementation SQL Migrations

This directory contains SQL scripts for the moment-level search implementation.

## Migration Order

Run these migrations in order:

### 1. `add_moment_search_indexing.sql`
**Purpose**: Creates the database schema for search indexing

**What it does**:
- Adds search fields to `project_images` table:
  - `searchVector`, `aiTags`, `aiColors`, `aiMaterials`, `aiSpaces`, `indexedAt`
  - `momentViews`, `momentSaves`, `momentShares` (engagement metrics)
- Creates `moment_index` table with denormalized search data
- Creates indexes for performance

**Run with**:
```sql
\i prisma/migrations/add_moment_search_indexing.sql
```

Or via psql:
```bash
psql $DATABASE_URL -f prisma/migrations/add_moment_search_indexing.sql
```

### 2. `backfill_moment_index.sql`
**Purpose**: One-time backfill of existing images into the search index

**What it does**:
- Populates `moment_index` from all existing `project_images`
- Combines explicit tags from `ProductTag` with AI tags
- Calculates initial engagement scores
- Builds search text from project/designer/image metadata

**Run with**:
```sql
\i prisma/migrations/backfill_moment_index.sql
```

**Note**: This may take a while for large databases. Monitor progress.

### 3. `create_search_functions.sql` (Optional)
**Purpose**: Creates helper SQL functions for search operations

**What it does**:
- `calculate_engagement_score()` - Calculates engagement from views/saves/shares
- `build_search_text()` - Builds searchable text from metadata
- `get_moments_by_tag()` - Query moments by tag with scope filtering
- `update_moment_index()` - Update index for a single image
- `get_trending_terms()` - Get trending search terms from signals

**Run with**:
```sql
\i prisma/migrations/create_search_functions.sql
```

### 4. `update_engagement_metrics.sql` (Maintenance)
**Purpose**: Sync engagement metrics from project to moments

**What it does**:
- Updates `momentViews`, `momentSaves`, `momentShares` from project metrics
- Recalculates engagement scores in `moment_index`

**Run periodically** (e.g., daily cron job):
```sql
\i prisma/migrations/update_engagement_metrics.sql
```

## Using Prisma Migrate

Alternatively, use Prisma's migration system:

```bash
# Generate migration from schema changes
npx prisma migrate dev --name add_moment_search_indexing

# Apply migration
npx prisma migrate deploy
```

## Verification Queries

After running migrations, verify with:

```sql
-- Check moment_index table exists
SELECT COUNT(*) FROM "moment_index";

-- Check project_images has new fields
SELECT 
    COUNT(*) FILTER (WHERE "aiTags" IS NOT NULL) as has_ai_tags,
    COUNT(*) FILTER (WHERE "momentViews" > 0) as has_views,
    COUNT(*) as total_images
FROM "project_images";

-- Check indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'moment_index';

-- Test search function (if created)
SELECT * FROM get_trending_terms(168); -- Last 7 days
```

## Troubleshooting

### Migration fails with "column already exists"
- Fields may have been added manually
- Use `IF NOT EXISTS` clauses (already included)
- Or drop columns first: `ALTER TABLE "project_images" DROP COLUMN IF EXISTS "aiTags";`

### Backfill is slow
- Run in batches by project:
```sql
-- Backfill one project at a time
INSERT INTO "moment_index" (...)
SELECT ... FROM "project_images" pi
WHERE pi."projectId" = 'specific-project-id'
AND NOT EXISTS (SELECT 1 FROM "moment_index" WHERE "projectImageId" = pi."id");
```

### Indexes not being used
- Run `ANALYZE "moment_index";` to update statistics
- Check query plans: `EXPLAIN ANALYZE SELECT ... FROM "moment_index" ...`

## Next Steps

After migrations:
1. Run initial indexing via TypeScript: `runFullReindex()` from `src/lib/search/indexMoment.ts`
2. Set up trigger or hook to index new images automatically
3. Create search UI page using the components in `src/components/search/`

