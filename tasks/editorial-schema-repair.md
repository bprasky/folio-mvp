# Approved mapping-only repair applied

## Verification — 2026-09-08

- Baseline git SHA: 13b1e0d70b4bc77576156b73fa43be1b281d85a1; tracked tree clean.
- Origin fetched; no new commits on origin/main.
- Backup: C:/Users/bpras/AppData/Local/Temp/schema-prisma-backup-editorial-mapping.prisma.
- Baseline schema SHA256: 02DFE83F1BA80EFB7BF989A6C2BB8289E4D025C17CCF80A98C6C642B24D3021D.
- Formatted schema SHA256: 2F52DD4288AEB9CC6666DC866D671AC1F3212D6F9F8411BFE4361C49C2FD56B5.
- Immediate and post-format diff: only 11 field mappings and one existing unique-index mapping across the three approved blocks.
- Format, validate and client generation pass. Migration status: 106 migrations, database up to date.
- Migration discipline: 32/32 loose SQL; zero phantom delegates, missing SQL or non-idempotent DDL.
- Prisma sync: 222 models and 103 enums agree; no missing fields.
- Generated DMMF confirms every approved field and all three table names. Generated client schema preserves editorial_assignment_project_category_unique.

SQL MIGRATION: NONE

DATABASE WRITES: NONE

### Read-only Prisma evidence

Each query below succeeded with zero rows/groups. This proves query execution and
column resolution, not populated-data transition behavior. Only counts were output.

```ts
await db.editorialCategory.findMany({ take: 1 });
await db.editorialAssignment.findMany({ take: 1 });
await db.editorialEdition.findMany({ take: 1 });
await db.editorialAssignment.findMany({
  take: 1,
  select: { editorialId: true, editorial: { select: { id: true, status: true } } },
});
// Exact category query from /api/magazine/filters:
await db.editorialAssignment.groupBy({
  by: ['categoryId'],
  where: { editorial: { status: 'PUBLISHED' } },
  _count: { editorialId: true },
  having: { editorialId: { _count: { gte: 2 } } },
});
await db.projectPost.findMany({
  where: {
    status: 'REVIEW',
    provenance: { path: ['editorialReview', 'submittedAt'], not: Prisma.AnyNull },
  },
  take: 1,
  select: { id: true },
});
```

editorial_assignment.editorialId P2022: RESOLVED

Production build exits 0. Log search for P2022, editorial_assignment,
editorial_category, editorial_edition and magazine filter errors returns zero matches.
Authorization/transition tests: 3 pass, 0 fail; the real DB group is skipped.
Single-generator, regenerate-surfaces and story-editing checks pass.
Client-import guard passes (2,203 files, 915 client modules).
IDOR unchanged: 0 Critical / 1 pre-existing High / 16 Medium / 19 Low across 558 routes.
No TypeScript source changed in this repair. Focused lifecycle/test lint: 0 errors,
1 existing test any warning.

REAL DATABASE TRANSITION JOURNEY — PARKED PENDING DISPOSABLE TEST DB

No disposable target or acknowledgement is configured. Persisted admin decisions,
concurrency and public-reader transition integration cases remain unrun. No infrastructure
was provisioned. The read-only persisted admin listing query succeeds.

### Architecture and scope review

Project → interview/source → ProjectPost DRAFT → REVIEW when required → PUBLISHED
→ public ProjectPost. Authorized self-publication can go directly DRAFT → PUBLISHED.
The shared transitionEditorial implementation transactionally synchronizes Project
visibility, status and publication timestamp. Legacy submissions route, dead curator,
separate in-memory review queue and client reviewer spoofing remain removed.
The separate persisted EditorialQueueItem concept is unchanged, as documented in the
consolidation audit. EditorialDraft and unrelated projects.json consumers remain.
Production-source reduction remains 1,560 net lines; this repair changes no src files.

## Applied blocks

No SQL, migration, data update, column rename, or backfill. Metadata and recorded
migration agree. These three replacement blocks map Prisma field names to the
existing database names. Schema was backed up before applying; format, validate, generate and migration
status passed. The explicit unique-index map preserves the existing index name.

```prisma
model EditorialCategory {
  id          String                 @id @default(cuid())
  type        String
  label       String
  centroid    Unsupported("vector")?
  createdAt   DateTime               @default(now()) @map("created_at")
  assignments EditorialAssignment[]

  @@unique([type, label])
  @@index([type])
  @@map("editorial_category")
}

model EditorialAssignment {
  id             String            @id @default(cuid())
  projectId      String            @map("project_id")
  editorialId    String            @map("editorial_id")
  categoryId     String            @map("category_id")
  editorialScore Float             @map("editorial_score")
  createdAt      DateTime          @default(now()) @map("created_at")
  project        Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  editorial      ProjectPost       @relation(fields: [editorialId], references: [id], onDelete: Cascade)
  category       EditorialCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([projectId, categoryId], map: "editorial_assignment_project_category_unique")
  @@index([categoryId])
  @@index([editorialId])
  @@map("editorial_assignment")
}

model EditorialEdition {
  id          String    @id @default(cuid())
  slug        String    @unique
  title       String
  intro       String
  categoryIds String[]  @map("category_ids")
  projectIds  String[]  @map("project_ids")
  publishedAt DateTime? @map("published_at")
  metrics     Json
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@map("editorial_edition")
}
```

TypeScript comparison: 1,006 diagnostics before and after; zero new diagnostics.

EDITORIAL CONSOLIDATION IMPLEMENTATION COMPLETE
