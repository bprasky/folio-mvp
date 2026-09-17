# Publishing Studio: schema proposal for review

**Status: proposed only, 17 September 2026. No schema edit, migration file, data migration, or database write has occurred.** The current shared hub can list project exports and recommendations. This proposal supplies the missing persistence for standalone editorial stories, their answers and approved versions, native social pieces, and campaigns spanning projects. User review of these blocks is required before implementing them under AGENTS.md's schema/migration gates.

## Verified baseline

`node tasks/studio-schema-readonly.cjs` first failed inside the sandbox with `PrismaClientInitializationError`; a network-escalated retry succeeded. The script starts a `READ ONLY` transaction, reads only schema columns/constraints and aggregate migration bookkeeping, and prints no connection configuration or application rows. Repeated metadata recon included all eight proposed table names below.

- The configured database has `editorial_queue_items`, `project_posts`, `instagram_campaigns`, and `instagram_campaign_posts`. Their IDs and referenced `users.id`, `organizations.id`, and `projects.id` are PostgreSQL **text**, not UUID columns.
- `instagram_campaigns.projectId` is non-null text with a cascading FK to projects. Its posts cascade from their campaign. Existing campaign timestamps are `timestamptz`; queue and project-post timestamps are `timestamp without time zone`. This proposal does not normalize those existing differences.
- Queue `prompts` is JSONB. `projectPostId` is nullable text with no FK in the inspected constraint list. It is not an answer store.
- Bookkeeping: **110 recorded, 109 applied, 0 unfinished**. This does not establish zero drift; it is not a substitute for migrate status.
- None of the eight proposed tables returned columns or constraints. The checked-in `ProjectPost.projectId` is `@unique`; no attempt was made to remove it. Unique indexes were not independently audited by the metadata script.
- Existing code callers audited: queue `index.ts`, `fetchRawCorpusLayer.ts`, `unlock.ts`; queue GET/generate routes; Instagram campaign generate, export, and generated-image routes. No current native editorial-answer completion or social version approval pipeline exists in these surfaces.

## Smallest coherent option

Use eight narrowly scoped tables: four for an editorial story and its versioned evidence/answers; four for a social piece and its approved versions, campaign, and ordered membership. This is more explicit than adding a JSON payload to the queue, but each table represents a required independent lifecycle or many-to-many relationship.

Keep legacy `InstagramCampaign` and `InstagramCampaignPost` as export history. Their required project, fixed export preset, expiry, and one-campaign-per-post ownership conflict with reusable native social pieces. Extending them would require making the project nullable, backfilling publishing identity, rewriting existing callers, and introducing approval/version semantics into historical rows that have never been approved. New tables avoid those historical rewrites. The hub aggregates both sources and labels old entries as export history. There is no automatic conversion or assumption of historical consent.

The checked-in `ProjectModule` was also evaluated as required by the spotlight/social spec: it requires one project, has optional creator ownership, stores media rather than versioned editorial answers, and exposes only a single publishedAt. Reusing it would still require the source/version/approval structures and changing existing feed/public-post readers. Keep those existing modules intact; native social landing/feed integration should consume SocialPiece's approved pointer explicitly. Likewise, the existing generic `Post` model describes folder/post-item collections, not this editorial publication contract.

An editorial story may originate from one queue item, have zero source projects for a practice-wide Q&A, or have several source project posts. Each social version derives from exactly one published project post or one approved editorial revision; a multi-project campaign assembles versions from several sources. An editorial campaign can carry a direct story association. Campaign membership pins the exact social version, never a mutable latest draft.

JSON below holds renderable document blocks and render manifests, their actual intended types. Ownership, answers, source links, versions, campaign membership, and approval states remain explicit fields/relations. Product-specific spotlight reuse remains unavailable until approved spotlight-version persistence exists; private spotlight answers must not be copied into these rows.

## Full proposed Prisma blocks

New table IDs remain text with application-generated UUIDs, matching existing FK targets. New dates use timestamptz(3). Status fields use strings with the SQL CHECKs below, avoiding additional database enum migration work.

```prisma
model EditorialStory {
  id String @id @default(uuid())
  ownerId String
  organizationId String?
  queueItemId String? @unique
  slug String @unique
  format String
  status String @default("draft")
  publishedRevisionNumber Int?
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  owner User @relation("StudioStoryOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  queueItem EditorialQueueItem? @relation(fields: [queueItemId], references: [id], onDelete: Restrict)
  revisions EditorialStoryRevision[] @relation("StudioStoryRevisions")
  publishedRevision EditorialStoryRevision? @relation("StudioPublishedStory", fields: [id, publishedRevisionNumber], references: [storyId, number], onDelete: Restrict, onUpdate: Restrict, map: "editorial_stories_published_fkey")
  campaigns SocialCampaign[]
  @@index([ownerId, organizationId, updatedAt])
  @@map("editorial_stories")
}

model EditorialStoryRevision {
  id String @id @default(uuid())
  storyId String
  number Int
  title String
  blocks Json
  approvedById String?
  approvedAt DateTime? @db.Timestamptz(3)
  consentScope String? // feed_only | feed_and_social; approval is version-specific
  publishedAt DateTime? @db.Timestamptz(3)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  story EditorialStory @relation("StudioStoryRevisions", fields: [storyId], references: [id], onDelete: Restrict)
  publishedFor EditorialStory[] @relation("StudioPublishedStory")
  approvedBy User? @relation("StudioStoryApprover", fields: [approvedById], references: [id], onDelete: Restrict)
  answers EditorialStoryAnswer[]
  sources EditorialStorySource[]
  socialVersions SocialPieceVersion[]
  @@unique([storyId, number])
  @@map("editorial_story_revisions")
}

model EditorialStoryAnswer {
  id String @id @default(uuid())
  revisionId String
  promptId String
  questionText String
  answerText String // raw authored wording, never replace with the generated paraphrase
  answeredById String
  answeredAt DateTime @default(now()) @db.Timestamptz(3)
  revision EditorialStoryRevision @relation(fields: [revisionId], references: [id], onDelete: Restrict)
  answeredBy User @relation("StudioStoryAnswerer", fields: [answeredById], references: [id], onDelete: Restrict)
  @@unique([revisionId, promptId])
  @@map("editorial_story_answers")
}

model EditorialStorySource {
  revisionId String
  projectPostId String
  sourceDigest String // hash of exact eligible source snapshot; not an approval by itself
  revision EditorialStoryRevision @relation(fields: [revisionId], references: [id], onDelete: Restrict)
  projectPost ProjectPost @relation(fields: [projectPostId], references: [id], onDelete: Restrict)
  @@id([revisionId, projectPostId])
  @@index([projectPostId])
  @@map("editorial_story_sources")
}

model SocialPiece {
  id String @id @default(uuid())
  ownerId String
  organizationId String?
  slug String @unique
  status String @default("draft")
  publishedVersionNumber Int?
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  owner User @relation("StudioSocialOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  versions SocialPieceVersion[] @relation("StudioSocialVersions")
  publishedVersion SocialPieceVersion? @relation("StudioPublishedSocial", fields: [id, publishedVersionNumber], references: [pieceId, number], onDelete: Restrict, onUpdate: Restrict, map: "social_pieces_published_fkey")
  @@index([ownerId, organizationId, updatedAt])
  @@map("social_pieces")
}

model SocialPieceVersion {
  id String @id @default(uuid())
  pieceId String
  number Int
  projectPostId String?
  storyRevisionId String?
  sourceDigest String
  title String
  caption String
  storyboard Json
  renderManifest Json? // private storage object keys/checksums; never public asset URLs
  approvedById String?
  approvedAt DateTime? @db.Timestamptz(3)
  publishedAt DateTime? @db.Timestamptz(3)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  piece SocialPiece @relation("StudioSocialVersions", fields: [pieceId], references: [id], onDelete: Restrict)
  publishedFor SocialPiece[] @relation("StudioPublishedSocial")
  projectPost ProjectPost? @relation(fields: [projectPostId], references: [id], onDelete: Restrict)
  storyRevision EditorialStoryRevision? @relation(fields: [storyRevisionId], references: [id], onDelete: Restrict)
  approvedBy User? @relation("StudioSocialApprover", fields: [approvedById], references: [id], onDelete: Restrict)
  campaignItems SocialCampaignItem[]
  @@unique([pieceId, number])
  @@index([projectPostId])
  @@index([storyRevisionId])
  @@map("social_piece_versions")
}

model SocialCampaign {
  id String @id @default(uuid())
  ownerId String
  organizationId String?
  storyId String? // explicit campaign supporting an editorial post
  title String
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  owner User @relation("StudioCampaignOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  story EditorialStory? @relation(fields: [storyId], references: [id], onDelete: Restrict)
  items SocialCampaignItem[]
  @@index([ownerId, organizationId, updatedAt])
  @@index([storyId])
  @@map("social_campaigns")
}

model SocialCampaignItem {
  campaignId String
  socialVersionId String
  position Int
  campaign SocialCampaign @relation(fields: [campaignId], references: [id], onDelete: Restrict)
  socialVersion SocialPieceVersion @relation(fields: [socialVersionId], references: [id], onDelete: Restrict)
  @@id([campaignId, socialVersionId])
  @@unique([campaignId, position])
  @@index([socialVersionId])
  @@map("social_campaign_items")
}
```

Exact inverse-only additions to existing blocks (no existing scalar/constraint changes):

```prisma
// User
studioStories EditorialStory[] @relation("StudioStoryOwner")
studioStoryApprovals EditorialStoryRevision[] @relation("StudioStoryApprover")
studioStoryAnswers EditorialStoryAnswer[] @relation("StudioStoryAnswerer")
studioSocialPieces SocialPiece[] @relation("StudioSocialOwner")
studioSocialApprovals SocialPieceVersion[] @relation("StudioSocialApprover")
studioCampaigns SocialCampaign[] @relation("StudioCampaignOwner")

// Organization
studioStories EditorialStory[]
studioSocialPieces SocialPiece[]
studioCampaigns SocialCampaign[]

// EditorialQueueItem
studioStory EditorialStory?

// ProjectPost
studioStorySources EditorialStorySource[]
studioSocialVersions SocialPieceVersion[]
```

## SQL draft, not an applied migration

Types of existing references were verified above. IDs and updatedAt are supplied by Prisma; UUID defaults therefore do not require a database extension. New tables only; existing rows are not backfilled or rewritten. On a preexisting table, `IF NOT EXISTS` does not prove its shape matches: rerun metadata and abort on differences before any application.

```sql
CREATE TABLE IF NOT EXISTS editorial_stories (
 id text PRIMARY KEY, "ownerId" text NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "organizationId" text REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "queueItemId" text UNIQUE REFERENCES editorial_queue_items(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 slug text NOT NULL UNIQUE, format text NOT NULL, status text NOT NULL DEFAULT 'draft',
 "publishedRevisionNumber" integer, "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" timestamptz(3) NOT NULL,
 CHECK (status IN ('draft','published','withdrawn')),
 CHECK (status <> 'published' OR "publishedRevisionNumber" IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS editorial_story_revisions (
 id text PRIMARY KEY, "storyId" text NOT NULL REFERENCES editorial_stories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 number integer NOT NULL CHECK(number > 0), title text NOT NULL, blocks jsonb NOT NULL,
 "approvedById" text REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "approvedAt" timestamptz(3), "consentScope" text, "publishedAt" timestamptz(3),
 "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("storyId",number),
 CHECK (("approvedAt" IS NULL AND "approvedById" IS NULL AND "consentScope" IS NULL)
   OR ("approvedAt" IS NOT NULL AND "approvedById" IS NOT NULL AND "consentScope" IS NOT NULL AND "consentScope" IN ('feed_only','feed_and_social'))),
 CHECK ("publishedAt" IS NULL OR "approvedAt" IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS editorial_story_answers (
 id text PRIMARY KEY, "revisionId" text NOT NULL REFERENCES editorial_story_revisions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "promptId" text NOT NULL, "questionText" text NOT NULL, "answerText" text NOT NULL,
 "answeredById" text NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "answeredAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("revisionId","promptId")
);
CREATE TABLE IF NOT EXISTS editorial_story_sources (
 "revisionId" text NOT NULL REFERENCES editorial_story_revisions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "projectPostId" text NOT NULL REFERENCES project_posts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "sourceDigest" text NOT NULL, PRIMARY KEY("revisionId","projectPostId")
);
CREATE TABLE IF NOT EXISTS social_pieces (
 id text PRIMARY KEY, "ownerId" text NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "organizationId" text REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 slug text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'draft', "publishedVersionNumber" integer,
 "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" timestamptz(3) NOT NULL,
 CHECK (status IN ('draft','published','withdrawn')),
 CHECK (status <> 'published' OR "publishedVersionNumber" IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS social_piece_versions (
 id text PRIMARY KEY, "pieceId" text NOT NULL REFERENCES social_pieces(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 number integer NOT NULL CHECK(number > 0),
 "projectPostId" text REFERENCES project_posts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "storyRevisionId" text REFERENCES editorial_story_revisions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "sourceDigest" text NOT NULL, title text NOT NULL, caption text NOT NULL,
 storyboard jsonb NOT NULL, "renderManifest" jsonb,
 "approvedById" text REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "approvedAt" timestamptz(3), "publishedAt" timestamptz(3),
 "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("pieceId",number),
 CHECK (num_nonnulls("projectPostId","storyRevisionId") = 1),
 CHECK (("approvedAt" IS NULL) = ("approvedById" IS NULL)),
 CHECK ("publishedAt" IS NULL OR ("approvedAt" IS NOT NULL AND "renderManifest" IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS social_campaigns (
 id text PRIMARY KEY, "ownerId" text NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "organizationId" text REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "storyId" text REFERENCES editorial_stories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 title text NOT NULL, "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" timestamptz(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS social_campaign_items (
 "campaignId" text NOT NULL REFERENCES social_campaigns(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "socialVersionId" text NOT NULL REFERENCES social_piece_versions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 position integer NOT NULL CHECK(position >= 0),
 PRIMARY KEY("campaignId","socialVersionId"), UNIQUE("campaignId",position)
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='editorial_stories'::regclass AND conname='editorial_stories_published_fkey') THEN
  ALTER TABLE editorial_stories ADD CONSTRAINT editorial_stories_published_fkey
   FOREIGN KEY(id,"publishedRevisionNumber") REFERENCES editorial_story_revisions("storyId",number) ON DELETE RESTRICT ON UPDATE RESTRICT;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='social_pieces'::regclass AND conname='social_pieces_published_fkey') THEN
  ALTER TABLE social_pieces ADD CONSTRAINT social_pieces_published_fkey
   FOREIGN KEY(id,"publishedVersionNumber") REFERENCES social_piece_versions("pieceId",number) ON DELETE RESTRICT ON UPDATE RESTRICT;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS "editorial_stories_ownerId_organizationId_updatedAt_idx" ON editorial_stories("ownerId","organizationId","updatedAt");
CREATE INDEX IF NOT EXISTS "editorial_story_sources_projectPostId_idx" ON editorial_story_sources("projectPostId");
CREATE INDEX IF NOT EXISTS "social_pieces_ownerId_organizationId_updatedAt_idx" ON social_pieces("ownerId","organizationId","updatedAt");
CREATE INDEX IF NOT EXISTS "social_piece_versions_projectPostId_idx" ON social_piece_versions("projectPostId");
CREATE INDEX IF NOT EXISTS "social_piece_versions_storyRevisionId_idx" ON social_piece_versions("storyRevisionId");
CREATE INDEX IF NOT EXISTS "social_campaigns_ownerId_organizationId_updatedAt_idx" ON social_campaigns("ownerId","organizationId","updatedAt");
CREATE INDEX IF NOT EXISTS "social_campaigns_storyId_idx" ON social_campaigns("storyId");
CREATE INDEX IF NOT EXISTS "social_campaign_items_socialVersionId_idx" ON social_campaign_items("socialVersionId");
```

The two composite FKs use matching explicit Prisma `map:` values. Generated default FK/unique names must also be compared with this draft before applying it. This document is review input, not permission to run this SQL directly. **Prisma 6.18.0 validation passed** after extracting these blocks and inverse additions into an isolated temporary copy of the current schema. The real schema was untouched. No migration was generated and no SQL/dev-DB application was performed.

## Required transaction and publication contract

1. **Author identity:** every mutation loads the actor and active workspace afresh, verifies direct ownership or the relevant organization capability, and verifies every source belongs to the authorized publishing identity. The hub's read access does not grant publishing rights. Reuse `normalizeRole`, designer tools permission, organization capability checks, and `assertProjectPublish` for each project source. Reject a cross-workspace campaign item even when the actor can separately access both workspaces.
2. **Version preservation:** answering/editing changes only an unapproved draft revision. Lock its parent revision row before answer/source changes and approval; all writers take this same lock so approval cannot race a child write. Approved editorial content, answers, sources and consent are immutable; editing clones them into the next numbered draft. Social edits likewise create a new version. Publication can set publishedAt once, but cannot change approved content. The SQL above does **not** alone enforce immutable rows or cross-row ownership: the reviewed write service and concurrency tests are release requirements. Add database triggers if non-service writers are introduced.
3. **Atomic publication:** lock the story/piece, verify expected revision, exact approval, current source eligibility and ready assets, then set publishedAt and the composite current-version pointer in one transaction. The unique `(entityId,number)` and current pointer make repeated publication of the same version idempotent. Do not notify/index twice; integrate an idempotent existing indexing job keyed by entity and version, or separately propose an outbox if no such worker exists.
4. **Source approvals:** a published ProjectPost alone does not approve a derived social version. Each source post must still be published under an authorized identity; validate the selected source snapshot digest, photo ownership/rights, and all selected source IDs against that project's approved public content. A changed digest requires review, not silent regeneration under an old approval. The material-study source join is complete: never drop an inaccessible source and publish the remainder. Studio-wide stories can have no project sources, but require their own authored answers and approval.
5. **Feed versus social:** `feed_only` permits approved editorial publication only. A social version sourced from an editorial revision requires `feed_and_social`, that exact revision currently published, all of its source projects still eligible, and its own exact social approval/publication. Story publication never automatically grants social consent. Public routes read only the current approved published pointer, never the newest draft. Private author routes include drafts.
6. **Export:** render manifests contain private storage keys and checksums, not bearer URLs. Recheck publisher permission, source publication/consent/digest, piece publication and requested exact version before creating short-lived download links. Withdrawal or parent unpublishing disables future links while preserving historical rows. Earlier externally downloaded files cannot be recalled. The old ZIP/slide/image endpoints must receive the same gate before this new native export flow is advertised; old history is not a consent bypass.
7. **Campaigns:** campaign state is derived from member versions; it is not a second publication flag. Add/reorder/remove membership under campaign ownership checks. The same approved social version can belong to multiple campaigns. Sources/project labels are derived through source relations; campaign filtering returns the complete matching campaign, not a clipped export.

## Application and rollback sequence after approval

Classification: **additive** new tables and inverse relation fields. No legacy field becomes nullable, no existing unique key changes, no historical exports or approvals are rewritten. Restrictive FKs intentionally prevent hard deletion of retained source evidence; existing deletion endpoints need explicit conflict handling before new rows are enabled.

1. Rerun metadata recon and `npm run prisma:status`; compare actual table shapes. Current migration counts alone are not migration status.
2. Back up schema before edits. Review the full User inverse additions above with the new blocks; after authorization, generate a create-only migration using the guarded command below. Compare generated SQL against this draft, including idempotence, CHECK constraints and mapped FK names.
3. If format/validate/generate/migrate-status fails, restore schema backup and stop. Do not apply SQL or resolve migrations until reviewed. Test on a verified development database first; never run schema:push against a production-shaped database.
4. Add write-service regression coverage for identity isolation, source withdrawal, feed-only consent, concurrent approval/answer saves, exact published-version exports, immutable approved content, and retry idempotency. Browser acceptance must demonstrate one cross-project story visible under both jobs, one post-level campaign, and preserved published content while editing a new draft.
5. Rollback before data exists: revert application/schema changes; leave unused additive tables pending a separately reviewed removal. After data exists: disable new writes and retain records; do not drop tables or rewrite old approvals as a rollback shortcut.

Exact command sequence after the review gate and verified environment selection:

```text
node tasks/studio-schema-readonly.cjs
npm run prisma:status
npm run migrate:create-only -- --name publishing_studio_native_content
# Review generated SQL; only then, against the verified development database:
npm run migrate:safe
npm run verify:prisma
npm run db:check
npm run schema:push
npm run prisma:status
# Production deployment is a separate authorized step after dev verification:
npm run migrate:deploy
```

`migrate:create-only` currently wraps `db:guard`; confirm npm argument forwarding before using its name argument. `migrate:safe` wraps guard and backup. `verify:prisma`/`db:check` are required after actual schema editing. No command above has been run for this proposal except metadata recon.

## Review risks

- Eight new tables are justified by independent editorial/social approval and reusable campaign membership; calendar, scheduling, video jobs, and vendor collaboration tables are deliberately outside this change.
- Existing source withdrawal must disable derived public visibility immediately, not only future generation. Public readers and download gates must walk the complete source chain.
- Restrictive source FKs change how existing hard-deletion requests fail once new content exists; handle that explicitly before launch.
- Draft/approval immutability and organization ownership are service/transaction invariants in this draft, not guarantees supplied by CHECK constraints alone.
- The existing spotlight approval model is incomplete. This proposal does not claim to unlock product-specific testimonials or private-answer reuse.
