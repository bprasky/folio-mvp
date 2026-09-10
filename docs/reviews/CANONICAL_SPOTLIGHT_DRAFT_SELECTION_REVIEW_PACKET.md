# Canonical spotlight draft-selection — self-contained review packet

Prepared 10 September 2026. **Review materials only. No approval has been granted or exercised.** This packet contains the exact draft-selection proposal plus the context and execution boundaries needed for a second reviewer. It does not implement the feature.

## 1. Baseline and changes since the review summary

| Item | Pinned value |
|---|---|
| Repository | [bprasky/folio-mvp](https://github.com/bprasky/folio-mvp) |
| Local branch | codex/spotlight-spec-foundation |
| Exact current source commit | a483ec202b66f588ec85cddcc34a745e92af269f |
| 10 September reviewed proposal commit | a483ec202b66f588ec85cddcc34a745e92af269f |
| Foundation-only predecessor | 1e4597d4e49e936c769f786ad023fc5e3b12fd17 |
| Main baseline used by the proposal | 8af4ce97dd6d85345c8e0a926a3c55ac82d4b306 |
| Active schema SHA-256 (UTF-8, LF) | 82def6c92d29cea387d5892eef4853ab58e9eca753810e1014532f95247119d7 |

**Artifact change status:** all four proposed artifacts and recon-summary.json were compared in full against the reviewed commit using Git object contents; they are unchanged. The active prisma/schema.prisma also matches that commit. This packet is a new local review artifact, not a new proposal revision or a claim that remote main is currently unchanged. No network fetch or database refresh was performed to prepare this packet.

**Design clarification status:** sections 6–8 make shared-toggle behavior, the no-exposure-before-complete-interview gate, and separate approval levels explicit. Those details were not all explicit in the earlier short summary. They clarify the service/UI contract without changing any embedded schema or SQL. They remain proposed behavior for review, not implemented functionality.

The proposal adds two tables, seven inverse fields across six existing Prisma models, eight FKs, nine indexes (including two partial unique indexes), four CHECK constraints and RLS on the two new tables. It adds no columns to existing tables, backfills, public content, grants on existing tables or vendor actions. The migration has no dependency on Shop storage. Shop repair, public publication models, social exports and vendor collaboration are excluded.

### Artifact integrity

The contents below are complete, including comments and blank lines. Only CRLF line endings are normalized to LF for embedding. Hashes use the entire UTF-8 LF content, including the final newline when present. For a file without a final LF, the newline separating its last character from the closing Markdown fence is a delimiter, not part of its hashed source; the table identifies that case. Files are embedded directly; no external document is needed to inspect the proposed changes.

| File | Final LF in source | SHA-256 (UTF-8, LF) |
|---|---|---|
| models.prisma | yes | 6a63461558a89a5ac78e99eccc34634af78e909b1186b7c9cb676c8195c54463 |
| inverse-fields.txt | yes | a271cd1f64ea5bee1f68302adfdd4a9547771e2afcde0726d3399864490257c0 |
| schema.patch | yes | feaa2845e1477bb6e380b9c4cb21f0e4a64015dbf453e38d824edee397008660 |
| migration.sql | yes | 77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab |
| recon-summary.json | no | 111f0932e5be2bb7165b1b0435e39340851d786a92a1c581b3e5106847b83861 |

## 2. Full proposed artifacts

### models.prisma — complete contents

```prisma
// PROPOSAL ONLY. Not part of the active Prisma schema.
// SQL-only checks and confirmed-room uniqueness are in migration.sql.
model ProductSpotlight {
  id              String   @id @default(uuid())
  projectId       String   @map("project_id")
  productId       String   @map("product_id")
  roomId          String?  @map("room_id")
  publisherUserId String?  @map("publisher_user_id")
  publisherOrgId  String?  @map("publisher_org_id")
  variant         String   @default("") @db.VarChar(160)
  finish          String   @default("") @db.VarChar(160)
  isSelected      Boolean  @default(true) @map("is_selected")
  privateNote     String?  @map("private_note")
  selectedById    String   @map("selected_by_id")
  selectedAt      DateTime @default(now()) @map("selected_at")
  selectionVersion Int     @default(1) @map("selection_version")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  project       Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  product       Product      @relation(fields: [productId], references: [id], onDelete: Restrict)
  room          Room?        @relation(fields: [roomId], references: [id], onDelete: SetNull)
  publisherUser User?         @relation("SpotlightPublisher", fields: [publisherUserId], references: [id], onDelete: Restrict)
  publisherOrg  Organization? @relation("SpotlightPublisherOrg", fields: [publisherOrgId], references: [id], onDelete: Restrict)
  selectedBy    User          @relation("SpotlightSelector", fields: [selectedById], references: [id], onDelete: Restrict)
  sourceTags    ProductSpotlightTag[]

  @@index([projectId, isSelected], map: "product_spotlights_project_selected_idx")
  @@index([productId], map: "product_spotlights_product_idx")
  @@index([roomId], map: "product_spotlights_room_idx")
  @@index([selectedById], map: "product_spotlights_selector_idx")
  @@index([publisherUserId], map: "product_spotlights_publisher_user_idx")
  @@index([publisherOrgId], map: "product_spotlights_publisher_org_idx")
  @@map("product_spotlights")
}

model ProductSpotlightTag {
  tagId       String   @id @map("tag_id")
  spotlightId String   @map("spotlight_id")
  linkedAt    DateTime @default(now()) @map("linked_at")

  tag       ProductTag       @relation(fields: [tagId], references: [id], onDelete: Cascade)
  spotlight ProductSpotlight @relation(fields: [spotlightId], references: [id], onDelete: Cascade)

  @@index([spotlightId], map: "product_spotlight_tags_spotlight_idx")
  @@map("product_spotlight_tags")
}
```

### inverse-fields.txt — complete contents

```text
// Add only these fields to existing model User:
  spotlightsAsPublisher ProductSpotlight[] @relation("SpotlightPublisher")
  selectedSpotlights ProductSpotlight[] @relation("SpotlightSelector")

// Add only these fields to existing model Organization:
  spotlightsAsPublisher ProductSpotlight[] @relation("SpotlightPublisherOrg")

// Add only these fields to existing model Project:
  productSpotlights ProductSpotlight[]

// Add only these fields to existing model Product:
  spotlights ProductSpotlight[]

// Add only these fields to existing model Room:
  productSpotlights ProductSpotlight[]

// Add only these fields to existing model ProductTag:
  spotlightLink ProductSpotlightTag?
```

### schema.patch — complete contents

```diff
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index aebf589d..692d3692 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -12,2 +12,6 @@ datasource db {
 model User {
+  // Product spotlight draft selection
+  spotlightsAsPublisher ProductSpotlight[] @relation("SpotlightPublisher")
+  selectedSpotlights ProductSpotlight[] @relation("SpotlightSelector")
+
   id                             String                    @id @default(uuid())
@@ -412,2 +416,5 @@ model EventWorkflowJob {
 model Project {
+  // Product spotlight draft selection
+  productSpotlights ProductSpotlight[]
+
   id                        String                     @id @default(uuid())
@@ -683,2 +690,5 @@ enum DisplayScope {
 model Product {
+  // Product spotlight draft selection
+  spotlights ProductSpotlight[]
+
   id                String             @id @default(uuid())
@@ -794,2 +804,5 @@ model Product {
 model ProductTag {
+  // Product spotlight draft selection
+  spotlightLink ProductSpotlightTag?
+
   id         String    @id @default(uuid())
@@ -924,2 +937,5 @@ model Category {
 model Room {
+  // Product spotlight draft selection
+  productSpotlights ProductSpotlight[]
+
   id            String         @id @default(uuid())
@@ -1001,2 +1017,5 @@ model ProjectFile {
 model Organization {
+  // Product spotlight draft selection
+  spotlightsAsPublisher ProductSpotlight[] @relation("SpotlightPublisherOrg")
+
   id           String      @id @default(uuid())
@@ -7946 +7965,48 @@ model LicenseGrant {
 }
+
+// SQL-only checks and confirmed-room uniqueness are in migration.sql.
+model ProductSpotlight {
+  id              String   @id @default(uuid())
+  projectId       String   @map("project_id")
+  productId       String   @map("product_id")
+  roomId          String?  @map("room_id")
+  publisherUserId String?  @map("publisher_user_id")
+  publisherOrgId  String?  @map("publisher_org_id")
+  variant         String   @default("") @db.VarChar(160)
+  finish          String   @default("") @db.VarChar(160)
+  isSelected      Boolean  @default(true) @map("is_selected")
+  privateNote     String?  @map("private_note")
+  selectedById    String   @map("selected_by_id")
+  selectedAt      DateTime @default(now()) @map("selected_at")
+  selectionVersion Int     @default(1) @map("selection_version")
+  createdAt       DateTime @default(now()) @map("created_at")
+  updatedAt       DateTime @updatedAt @map("updated_at")
+
+  project       Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
+  product       Product      @relation(fields: [productId], references: [id], onDelete: Restrict)
+  room          Room?        @relation(fields: [roomId], references: [id], onDelete: SetNull)
+  publisherUser User?         @relation("SpotlightPublisher", fields: [publisherUserId], references: [id], onDelete: Restrict)
+  publisherOrg  Organization? @relation("SpotlightPublisherOrg", fields: [publisherOrgId], references: [id], onDelete: Restrict)
+  selectedBy    User          @relation("SpotlightSelector", fields: [selectedById], references: [id], onDelete: Restrict)
+  sourceTags    ProductSpotlightTag[]
+
+  @@index([projectId, isSelected], map: "product_spotlights_project_selected_idx")
+  @@index([productId], map: "product_spotlights_product_idx")
+  @@index([roomId], map: "product_spotlights_room_idx")
+  @@index([selectedById], map: "product_spotlights_selector_idx")
+  @@index([publisherUserId], map: "product_spotlights_publisher_user_idx")
+  @@index([publisherOrgId], map: "product_spotlights_publisher_org_idx")
+  @@map("product_spotlights")
+}
+
+model ProductSpotlightTag {
+  tagId       String   @id @map("tag_id")
+  spotlightId String   @map("spotlight_id")
+  linkedAt    DateTime @default(now()) @map("linked_at")
+
+  tag       ProductTag       @relation(fields: [tagId], references: [id], onDelete: Cascade)
+  spotlight ProductSpotlight @relation(fields: [spotlightId], references: [id], onDelete: Cascade)
+
+  @@index([spotlightId], map: "product_spotlight_tags_spotlight_idx")
+  @@map("product_spotlight_tags")
+}
```

### migration.sql — complete contents

```sql
-- REVIEW PROPOSAL ONLY: outside prisma/migrations; do not execute before approval.
-- Additive draft-selection storage. No backfill, public activation or outreach.
-- Existing referenced IDs were verified as TEXT on 2026-09-10.
BEGIN;

CREATE TABLE IF NOT EXISTS public.product_spotlights (
  id TEXT NOT NULL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  room_id TEXT REFERENCES public.rooms(id) ON DELETE SET NULL ON UPDATE CASCADE,
  publisher_user_id TEXT REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  publisher_org_id TEXT REFERENCES public.organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  variant VARCHAR(160) NOT NULL DEFAULT '',
  finish VARCHAR(160) NOT NULL DEFAULT '',
  is_selected BOOLEAN NOT NULL DEFAULT true,
  private_note TEXT,
  selected_by_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  selected_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  selection_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  CONSTRAINT product_spotlights_publisher_xor CHECK (
    (publisher_user_id IS NOT NULL) <> (publisher_org_id IS NOT NULL)
  ),
  CONSTRAINT product_spotlights_version_positive CHECK (selection_version > 0),
  CONSTRAINT product_spotlights_variant_trimmed CHECK (variant = btrim(variant)),
  CONSTRAINT product_spotlights_finish_trimmed CHECK (finish = btrim(finish))
);

-- Unresolved rooms are deliberately excluded: never guess that two unknown
-- room usages are the same. The tag PK below deduplicates repeated selection
-- of one tag; confirmed-room assignment performs a transactional merge.
CREATE UNIQUE INDEX IF NOT EXISTS product_spotlights_person_scope_key
  ON public.product_spotlights (publisher_user_id, project_id, product_id, room_id, variant, finish)
  WHERE publisher_user_id IS NOT NULL AND room_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_spotlights_org_scope_key
  ON public.product_spotlights (publisher_org_id, project_id, product_id, room_id, variant, finish)
  WHERE publisher_org_id IS NOT NULL AND room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_spotlights_project_selected_idx
  ON public.product_spotlights (project_id, is_selected);
CREATE INDEX IF NOT EXISTS product_spotlights_product_idx
  ON public.product_spotlights (product_id);
CREATE INDEX IF NOT EXISTS product_spotlights_room_idx
  ON public.product_spotlights (room_id);
CREATE INDEX IF NOT EXISTS product_spotlights_selector_idx
  ON public.product_spotlights (selected_by_id);
-- Non-partial indexes support publisher FK checks, including unresolved rooms.
CREATE INDEX IF NOT EXISTS product_spotlights_publisher_user_idx
  ON public.product_spotlights (publisher_user_id);
CREATE INDEX IF NOT EXISTS product_spotlights_publisher_org_idx
  ON public.product_spotlights (publisher_org_id);

CREATE TABLE IF NOT EXISTS public.product_spotlight_tags (
  tag_id TEXT NOT NULL PRIMARY KEY REFERENCES public.product_tags(id) ON DELETE CASCADE ON UPDATE CASCADE,
  spotlight_id TEXT NOT NULL REFERENCES public.product_spotlights(id) ON DELETE CASCADE ON UPDATE CASCADE,
  linked_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS product_spotlight_tags_spotlight_idx
  ON public.product_spotlight_tags (spotlight_id);

-- New data is private and server-mediated. No anon/authenticated policy.
-- Prisma's existing privileged server connection is the only intended writer.
ALTER TABLE public.product_spotlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_spotlight_tags ENABLE ROW LEVEL SECURITY;

COMMIT;
```

## 3. Existing schema context

The following are **selected existing field declarations copied verbatim from the active schema at the pinned commit**, enclosed by their model names and table mappings. They are relevant context, not replacement model blocks and not runnable standalone schema. Unrelated profile/business fields are intentionally excluded. No proposed relation field has been inserted here. OrganizationUser is included as supporting context for active membership authority; it is not changed by the proposal. All required User, Organization, Project, Product, Room, ProductTag and ProjectImage context is present.

### Existing User

```prisma
model User {
  id                             String                    @id @default(uuid())
  role                           Role                      @default(INDIVIDUAL)
  organizationUsers              OrganizationUser[]
  designerProjects               Project[]                 @relation("DesignerProjects")
  ownedProjects                  Project[]                 @relation("OwnedProjects")
  products                       Product[]                 @relation("VendorProducts")
  operatingAsOrgId String?
  operatingAsOrg   Organization? @relation("UserOperatingAs", fields: [operatingAsOrgId], references: [id])
  @@map("users")
}
```

### Existing Organization

```prisma
model Organization {
  id           String      @id @default(uuid())
  type         OrgType     @default(DESIGN_FIRM)
  status  OrgStatus @default(UNCLAIMED)
  users                OrganizationUser[]
  designerProjects     Project[]            @relation("DesignerProjects")
  usersOperatingAs     User[]               @relation("UserOperatingAs")
  @@map("organizations")
}
```

### Existing Project

```prisma
model Project {
  id                        String                     @id @default(uuid())
  ownerId                   String
  designerId                String?
  designerOrgId             String?
  isPublic                  Boolean                    @default(false)
  publishedAt               DateTime?
  status                    String                     @default("active")
  owner                     User                       @relation("OwnedProjects", fields: [ownerId], references: [id])
  designer                  User?                      @relation("DesignerProjects", fields: [designerId], references: [id])
  designerOrg               Organization?              @relation("DesignerProjects", fields: [designerOrgId], references: [id])
  rooms                     Room[]
  images                    ProjectImage[]
  selections                Selection[]
  post                      ProjectPost?
  @@map("projects")
}
```

### Existing Product

```prisma
model Product {
  id                String             @id @default(uuid())
  brand             String?
  vendorId          String?
  vendor            User?              @relation("VendorProducts", fields: [vendorId], references: [id])
  tags              ProductTag[]
  @@map("products")
}
```

### Existing Room

```prisma
model Room {
  id            String         @id @default(uuid())
  name          String
  projectId     String
  project       Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  selections    Selection[]
  projectImages ProjectImage[] @relation("RoomProjectImages")
  @@map("rooms")
}
```

### Existing ProductTag

```prisma
model ProductTag {
  id         String    @id @default(uuid())
  productId  String
  imageId    String
  finishRaw       String?      @map("finish_raw")
  finishCanonical String?      @map("finish_canonical")
  finishConfirmed Boolean      @default(false) @map("finish_confirmed")
  product         Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  image           ProjectImage @relation(fields: [imageId], references: [id], onDelete: Cascade)
  selection       Selection? // Selection created from this tag
  @@map("product_tags")
}
```

### Existing ProjectImage

```prisma
model ProjectImage {
  id           String       @id @default(uuid())
  projectId    String
  project      Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  room         String?
  roomId       String?
  assignedRoom Room?          @relation("RoomProjectImages", fields: [roomId], references: [id], onDelete: SetNull)
  tags         ProductTag[]
  inclusion    ImageInclusion @default(INCLUDED)
  noProducts   Boolean        @default(false)
  @@map("project_images")
}
```

### Existing OrganizationUser

```prisma
model OrganizationUser {
  id             String      @id @default(uuid())
  userId         String
  organizationId String
  role           OrgUserRole @default(MEMBER)
  isActive       Boolean     @default(true)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId])
  @@map("organization_users")
}
```

### Relationship and deletion interpretation

Referenced ID columns were observed as TEXT. A Prisma uuid() default is a client-generated value here, not evidence that a column is PostgreSQL UUID. Existing schema omissions of an explicit referential action must not be read as absence of a database FK. The recorded live metadata confirmed these relevant actions:

| Existing FK path | Observed live ON DELETE behavior | Relevance to proposal |
|---|---|---|
| projects.ownerId → users.id | RESTRICT | Existing project owner protection remains. |
| projects.designerId → users.id | SET NULL | New spotlight publisher/selector references instead use RESTRICT; deleting a referenced person can now be blocked until spotlight dependencies are resolved. |
| projects.designerOrgId → organizations.id | SET NULL | New spotlight publisher-org reference uses RESTRICT, preserving attribution instead of silently clearing it. |
| rooms.projectId → projects.id | CASCADE | Project deletion also cascades spotlight drafts directly. Exercise the whole cascade in tests. |
| project_images.projectId → projects.id | CASCADE | Image deletion cascades tags, then their new source links. |
| project_images.roomId → rooms.id | SET NULL | Legacy room string is not an authoritative substitute. |
| product_tags.imageId → project_images.id | CASCADE | Deleting a photo removes its tags/source links, not the shared spotlight row. |
| product_tags.productId → products.id | CASCADE | The new spotlight.product_id RESTRICT can block product deletion despite the old tag cascade. |
| products.vendorId → users.id | SET NULL | Vendor association is optional; it does not authorize or gate designer selection. |

These are the relevant observed FK paths, not an audit of every dependency on those tables. The active schema's User.operatingAsOrgId is a UI operating context, not the spotlight publisher authority. Resolve the publisher from the actual project. A designerOrgId selects the organization publisher; otherwise use designerId, with ownerId as fallback. The actor selectedById remains separate. A project/organization ownership change must not silently rewrite historic attribution.

Draft mutations must use the existing assertProjectWrite authority contract, not the broader assertProjectView check, and revalidate current permission and scope consistently with the transaction. No publishing capability is introduced here; later publication has a different authority gate and is outside this approval.

## 4. Sanitized reconnaissance

This is the complete existing recon-summary.json. It contains aggregate counts, structural facts and a migration name, not individual record IDs. No credentials, connection strings, hostnames, person/contact fields, quotes or answers are included.

```json
{
  "auditedAt": "2026-09-10",
  "scope": "configured application and direct database; metadata and aggregates only",
  "columnCount": 305,
  "constraintCount": 32,
  "existingSpotlightTables": [],
  "relatedShopTables": [],
  "migrations": [
    {
      "recorded": 108,
      "applied": 107,
      "unfinished": 0
    }
  ],
  "stats": [
    {
      "projects": 6,
      "org_projects": 6,
      "projects_without_designer": 0,
      "rooms": 36,
      "images": 37,
      "images_without_room_fk": 8,
      "image_room_project_mismatch": 0,
      "tags": 59,
      "tags_without_selection": 17,
      "tags_with_finish": 0,
      "answer_projection_rows": 81,
      "posts_with_answer_payload": 6
    }
  ],
  "tagGroups": [
    {
      "repeated_room_product_groups": 0
    }
  ],
  "legacyShop": "MISSING_TABLE",
  "testimonials": "MISSING_TABLE",
  "connectionChecks": {
    "app": {
      "server": [
        {
          "version": "170004",
          "schema": "public"
        }
      ],
      "missing": [
        {
          "shop": null,
          "testimonials": null
        }
      ],
      "bookkeeping": [
        {
          "migration_name": "20260709163000_add_pdf_extractions_skeleton_items",
          "finished": false,
          "rolled_back": true
        }
      ]
    },
    "direct": {
      "server": [
        {
          "version": "170004",
          "schema": "public"
        }
      ],
      "missing": [
        {
          "shop": null,
          "testimonials": null
        }
      ],
      "bookkeeping": [
        {
          "migration_name": "20260709163000_add_pdf_extractions_skeleton_items",
          "finished": false,
          "rolled_back": true
        }
      ]
    }
  }
}
```

### What was and was not verified

- On 10 September, the locally configured application DATABASE_URL connection was inspected with a read-only transaction for relevant columns, FKs, table existence and aggregate counts.
- The locally configured DIRECT_URL migration connection was separately checked for server version/schema, the missing Shop/testimonial tables and relevant bookkeeping. Both checks reported PostgreSQL 17.4/public and consistent results. This is two connection paths to the configured application database, not proof of two distinct deployment environments.
- The local override/base environment comparison reported no different database targets for those settings. Connection values are intentionally excluded. The complete set of 305-column/32-constraint and usage-count queries was not repeated through both paths; do not mistake the narrower direct-connection verification for an independently repeated full audit.
- CLI migration status reported 107 repository migrations up to date. There were 108 bookkeeping rows: 107 applied and one historical rolled-back attempt, with no unresolved attempt. That does not prove complete schema parity.
- **The deployed Vercel environment, its database binding, its credentials and its runtime behavior remain unverified by this proposal.** The configured target must not be relabeled “production verified.” A later target-apply approval must identify and reverify its destination without exposing secrets.
- No disposable database was used. No database connections, SQL or data reads were performed while preparing this packet; the dated recon is reused, not represented as newly refreshed evidence.

The important bounds are 17 of 59 tags without Selection links, 8 of 37 images without room IDs, and no observed repeated confirmed-room/product/exact-finish groups. These motivate validation and fixtures; they do not prove grouping behavior. All six observed projects are organization-associated, so individual publishing needs fixture coverage. shop_products and product_testimonials are **missing tables**, not empty tables; their row counts are unavailable. Their future repair is outside this packet and cannot be inferred from clean migration bookkeeping.

## 5. Constraint-to-invariant mapping

| Invariant | Database enforcement in this migration | Required server behavior / limits |
|---|---|---|
| One publishing identity | XOR CHECK permits exactly one non-null publisher_user_id or publisher_org_id; FKs require the referenced row to exist. | Resolve publisher from persisted Project fields, never request-supplied identity or UI operating context. Verify current project/publisher consistency and actor authority. XOR alone does not prove ownership. |
| Actor attribution | selected_by_id is NOT NULL and references users; selected_at has a timestamp default. | The authenticated selecting actor supplies these through the server. Preserve “last explicit selection,” not a fabricated full edit audit. Membership/role changes must be checked live. |
| Same-project room | room_id is nullable and references an existing Room. | Verify Room.projectId equals Spotlight.projectId. A FK alone admits an existing room from another project. Require explicit room confirmation before questions. |
| Same-project tag and product | Link FKs require spotlight and tag existence. Tag already references product and image; image references project. | Validate Tag.productId equals Spotlight.productId and Tag.image.projectId equals Spotlight.projectId. Revalidate after tag/image reassignment. Photo room strings/Selection backfills cannot establish canonical spotlight room. Conflicting room evidence needs explicit correction, not guessing. |
| One canonical confirmed scope | Two partial unique indexes enforce publisher + project + product + non-null room + exact variant + exact finish, including deselected rows. | Use those keys to find/reuse the canonical record. Case/wording are preserved; trim outer spaces and do not fuzzy-merge. Conflicting confirmed finishes remain distinct. Index protection is not authorization. |
| Unresolved room grouping | NULL-room rows are excluded from scope indexes; multiple unresolved drafts are allowed. | Never merge unknown rooms by product prominence. Repeated selection of the same tag resolves its link. On confirmed assignment, transactionally join the destination scope and preserve history/notes. |
| One current link per tag | tag_id is the link-table primary key; multiple tags can point to one spotlight. | Selecting another linked photo does not create a separate question or independent per-tag selected flag. Do not silently reselect a previously deselected shared spotlight just because an automated tag appeared. |
| Concurrent writes | Primary/unique indexes reject duplicates; FKs protect references; positive version CHECK rejects zero/negative counters. | SERIALIZABLE transaction with bounded retry, compare-and-swap on selectionVersion, and fresh permission/scope reads. DB does not auto-increment the counter or enforce expected versions. A conflict requires reread/reconciliation, not a blanket success response. |
| Retry semantics | No request-idempotency table/column is present. | Same tag/scope already at requested state returns the existing result; competing state changes require expected-version checking. Exact request history/idempotency storage for later answer writes still needs design. Unique rows alone do not prove operation-level idempotence. |
| Variant/finish representation | VARCHAR(160), NOT NULL, empty defaults, outer-space btrim checks. | Reject overlong inputs explicitly; do not truncate. Unknown empty values are not confirmed finishes. JS normalization must be consistent with SQL; checks do not perform semantic identification. |
| Private drafts | RLS enabled on new tables, no anon/authenticated policies, no public/publication field. | Existing privileged server connection bypasses RLS and must enforce authorization. Never expose privateNote in a public response. Adding these tables does not by itself prove all server reads are private. Verify effective policies/grants/roles in disposable and target postflight. |
| Scheduling eligibility | Not enforced: no question/status table in this migration. | Require selected=true, current correct publisher/project/product, confirmed room and at least one valid source. Zero-source/unresolved drafts remain actionable and unscheduled. |
| Last edit/version | Date fields/defaults and positive version only. | Prisma @updatedAt is client behavior, not a SQL trigger. Server edits must update timestamp/counter. FK cascades/SET NULL do not increment the counter; cache signatures must include actual scope and sources. |

### Deletion and source retention

| Operation | Database result | Required service/UI result |
|---|---|---|
| Delete one ProductTag | Cascades only its ProductSpotlightTag link. | Keep shared isSelected unchanged. If another valid source remains, keep the spotlight and base-question identity eligible; invalidate source-dependent caches and revalidate any in-flight request. |
| Delete a ProjectImage | Existing cascade removes its tags and their links. | Same rule across all affected spotlights; do not globally deselect a piece that still has another source. |
| Remove the last valid source | No link remains; spotlight row/isSelected survive. | Show “No linked photos — add a source or remove this spotlight.” No active new question/save/follow-up against missing source scope. Retain previous answers; do not report completed coverage or silently remove the explicit selection. |
| Delete a Room | New spotlight.room_id SET NULL; row and links survive. | Show unresolved room, retire stale active scheduling, preserve answer snapshots, require room reassignment. NULL exclusion avoids merging formerly distinct room contexts. |
| Delete a Product | RESTRICT while a spotlight references it. | Resolve/report dependency; do not let old ProductTag CASCADE silently erase the selected product context. |
| Delete publisher User, publisher Organization or selecting User | RESTRICT while referenced. | This adds deletion dependencies to existing flows. Review those handlers and test them before exposure; no silent reassignment/nulling is authorized. |
| Delete a Project | CASCADE its spotlights/links plus existing project-owned relations. | Apply existing project-delete permission. No new delete permission is granted. Later immutable history retention must be explicitly designed against project deletion before its schema is approved. |
| Delete a ProductSpotlight row | CASCADE its source links; ProductTags survive. | Not the “Spotlight off” operation. Restrict any hard-delete service to an empty, never-answered merge placeholder after preserving notes. Later question/answer history must prevent accidental historical deletion. |

IF NOT EXISTS provides replay guards, not definition equivalence. Existing tables/indexes with those names could be incompatible. Preflight must stop and inspect unexpected existing objects; postflight must compare actual definitions. Partial indexes, CHECKs and RLS are SQL-only parts of this contract, not fully represented in the Prisma model blocks. Do not use db push to reconstruct them.

## 6. Resolved shared-selection behavior

**Yes: turning “Spotlight” off from any linked photo tag deselects the one shared spotlight for that publisher/project/product/room/variant/finish.** Selection belongs to the piece in the room, not to each photograph. Other room/variant/finish scopes are unaffected. All linked tag controls read the same server isSelected value. No tag or existing answer is deleted by deselection.

Proposed UI contract (new clarification, not an implemented screen):

1. The control says “Spotlight this piece.” For a grouped piece, show “One spotlight shared across 3 photos in Dining Room.” The number and room come from the canonical record's valid sources.
2. When switching a shared spotlight off, an inline review states: “Stop spotlighting this piece in Dining Room? This applies to all 3 linked photo tags. Your tags and saved answers will stay.” Actions: “Stop spotlighting this piece” and “Keep spotlight.” This is a user-facing edit confirmation for the shared effect, not consent to publication or outreach.
3. On success, all related controls and the room review show it off. A stale concurrent edit refreshes the canonical state and reports the conflict; it does not leave contradictory photo-specific states.
4. Reselecting uses the same canonical spotlight. Existing eligible answers are offered for explicit confirmation/reuse; they are not erased or silently treated as newly approved testimony. No automatic tagging action turns the spotlight on.

**Deleting one photo tag is a different operation:** it removes that source link only. It must not write isSelected=false when other valid sources remain. It updates source count and cache eligibility; an unchanged valid piece retains its stable base question. Deleting the last source leaves the selected draft visible as needing a source, not an invented complete/answered state. Turning Spotlight off is not a per-photo exclusion switch. A separate source-management control, if later needed, must not overload its meaning.

Acceptance cases must prove these distinctions with a shared spotlight linked to three tags: off on tag A turns the canonical selection and all three UI views off; delete tag A leaves the other two links and selection intact; delete the final valid source preserves saved history but disables new scheduling. Independent rooms and variants remain unaffected in every case.

## 7. Complete tagging → interview → saved-answer milestone

This migration supplies selection storage only. It cannot make the first interview milestone complete, and schema approval must not be described as permission to expose a partially working Spotlight toggle. Keep the new flow unavailable to ordinary users until the following linked sequence passes in an isolated test environment. Existing unrelated interview behavior must remain available. The exact rollout switch/capability and its server enforcement are still implementation artifacts to review; none is added by this packet.

### Remaining implementation sequence

1. **Draft-selection service and UI:** after scoped schema approval/testing, implement server-owned publisher and room/source resolution, shared toggle semantics, canonical grouping, transactional edits and no automatic selection from imports/backfills. Preserve private notes and explicit source state. Build the UI against this real service behind the exposure gate.
2. **Scheduled-question and answer-revision design:** author exact follow-on schema/SQL/API contracts for durable question snapshots, immutable answer revisions, idempotent save identity, confirmed-reuse records and current answer pointers. Review them separately; they are not covered by the two-table migration. Decide FK/deletion history semantics and initial legacy-answer capture before applying them. Avoid speculative placeholder JSON fields in this migration.
3. **Stable question scheduling:** persist stable questionId, spotlightId, confirmed roomId, productId, sourceTagIds, linkedImageIds, questionKind and policy/prompt version. Exactly one active base slot per eligible spotlight, outside optional room caps. Source/version changes refresh eligibility without reminting an unchanged answered question. Different answered product/room/variant context gets a distinct scope; preserve the old question/history. Unresolved/zero-source drafts show work remaining instead of being marked complete.
4. **Generation and exclusion:** server schedules; model supplies bounded, grounded wording. Validate membership, room/product/source associations, missing coverage, duplicates and semantic targeting of unselected objects. Retry within bounds, then selected-piece deterministic fallback; use safe room-only wording for uncertain general questions. Paginate large selected sets. No vendor-state branch or descriptor loophole. A product follow-up retains the eligible parent spotlight and is at most one optional clarification under the adopted default.
5. **Immutable answer acceptance:** use the scheduled server question and current eligibility, never caller scope. Atomically append the exact accepted answer revision, its stable ID/version, answering identity, full question/source snapshot and source locator; update the current canonical reference in the same transaction. A hash supplements retained raw text; it cannot replace it. Re-answering creates a new revision, while an identical retried accepted request reuses its result. Conflicting content under one idempotency key must be rejected, not overwritten.
6. **Integrate the existing answer source:** existing posting provenance remains the source for legacy answers; its projection writer remints EditorialInterviewAnswer row IDs. Do not FK immutable history to that row ID. The follow-on design must make the spotlight answer revision authoritative for its accepted version and keep the ProjectPost provenance current pointer/compatible payload consistent in the same transaction. Projection rebuilds derive from that source and never destroy revision history. Reconcile reachable legacy respond/complete and realtime conversion paths so they cannot bypass acceptance or create a second authoritative writer. Private audio references, when available, use stable asset/transcript versions rather than expiring URLs.
7. **Resume, reconciliation and deselection:** reload persisted question IDs and accepted versions, not regenerated client guesses. Cache keys include actual selected state, publisher/room/product context, source IDs and policy version; selectionVersion alone is insufficient after FK cascades. Deselecting retires active slots/follow-ups and rejects stale work without deleting immutable answers. A model “covered”/“morphed” verdict cannot remove a mandatory slot. Confirmed reuse is a recorded designer action. Room/source/product changes preserve prior answers and reconcile incrementally, without dropping unrelated work.
8. **Full milestone gate:** run database/handler integration, browser journey, retry/race and semantic exclusion acceptance with the actual linked implementation; inspect failures and demonstrate saved answers survive restart/resume/reprojection. Only then consider exposure under a separately approved deployment/rollout. This does not require implementing public publication or any excluded feature.

### Concrete pre-exposure test plan — not yet executed

Use a disposable PostgreSQL database with a faithful fixture for existing tables touched by the real handlers and the actual approved migrations. Do not substitute an in-memory success response for persistence. Mock only external model/media boundaries for deterministic failure and retry tests; retain real authorization, transactions, writes and reads. Separate SQL contract fixtures from the full integration fixture so minimal FK-table tests are not presented as end-to-end proof.

| Test family | Required evidence |
|---|---|
| Selection → scheduled questions → saved answer | Actual handler/service/browser journey: create tag, explicitly select, confirm room, start interview, receive stable eligible question, save raw answer, reload it through the canonical read path and resume. Repeat with no Selection backfill. |
| Coverage and exclusion | Ten products/two spotlights yields exactly those two base product slots; zero selection yields room/project questions only. Repeated tags share one slot, distinct rooms separate, selections above room budget remain covered. Provider timeout/invalid output produces safe fallback or visible remaining work. |
| Shared semantics | Three linked tags: shared off affects one spotlight/all related controls; deleting one tag keeps selection and eligible history with two sources; deleting last source makes actionable ineligibility. |
| Actual persistence | Restart the application/test process; query durable records through the public-to-owner read API and verify IDs/text/versions unchanged. Rebuild EditorialInterviewAnswer projection and prove immutable revision IDs/contents survive. |
| Revision safety | Re-answer preserves old raw revision, adds new revision and updates current reference atomically. Simultaneous answers to different questions do not overwrite each other's provenance. Simulate failure between append and pointer update and prove transaction rollback. |
| Request retry and race | Concurrent same-tag selection converges to one canonical row/link; conflicting versions report conflict. Duplicate answer save does not duplicate revisions. If deselection commits first, a stale save/follow-up is rejected while client text is retained for recovery; if save commits first, subsequent deselection preserves that saved revision. |
| Scope tampering and role changes | Wrong publisher/room/project/product/tag IDs, stale source links, inactive studio role and cross-studio requests fail. Include individual publisher fixtures because live recon only sampled org projects. |
| Alternate paths | Single/batch/generic follow-ups, cache fallback, resumed/regenerated/background paths and reachable legacy/realtime save paths resolve the same eligible IDs. Unsupported paths must explicitly decline the new scope rather than silently bypass it. Biography/unrelated commissioned flows retain their own contract. |
| No side effects | Assert draft tagging/answer saves create no public Shop/testimonial record, invitation, notification or export asset; model context and public reads cannot leak private notes. |
| Model meaning and UI | Curated selected/unselected product fixtures, including descriptor loopholes and voluntary mentions; deterministic validators plus a separately controlled evaluation of generated wording. Mobile/browser review checks room/source count, shared deselection disclosure, saved answer/resume, unresolved drafts and error recovery. Prompt snapshots alone are insufficient. |

Passing the selection migration's FK/index tests is necessary but insufficient. Passing mocked-provider integration is not proof of live model semantic quality. No new feature exposure is permitted until the whole private interview milestone meets these acceptance checks and the remaining review gates are satisfied.

## 8. Validation evidence and approval boundaries

### Evidence actually obtained

| Check | Timing and result | Classification / limit |
|---|---|---|
| Complete artifact and active-schema comparison to a483ec20 | Reperformed for this packet; all five embedded source files and active schema match reviewed Git content after LF normalization. | Static content integrity; no runtime claim. |
| git apply --check on schema.patch | Passed during proposal preparation and repeated for this packet. | Patch applicability only; patch not applied. |
| Isolated Prisma format/validate | Format and validation passed during 10 September proposal work; isolated candidate validation passed again for this packet. Active schema unchanged. | Static Prisma consistency, not SQL execution. |
| Prisma schema-to-schema migrate diff | Previously produced exactly two new tables, seven ordinary indexes and eight FKs, without existing-table alterations. SQL adds two partial indexes, four CHECKs and RLS separately. | DDL generation from datamodels, not database mutation or full live drift verification. |
| Proposal structural verifier | Repeated; counts match 2 tables/8 FKs/9 indexes/4 CHECKs/2 RLS enables; no data/backfill statements, canonical schema checksum unchanged. | Static pattern assertions, not a SQL parser/execution proof or exhaustive semantic verification. |
| Migration discipline --ci | Repeated; passes 32/32 loose SQL, 0/0 phantom calls, 0/0 missing SQL, 0/0 recent non-idempotent patterns. | Repo ratchet; this proposal SQL is outside active migrations, and the ratchet does not prove live table parity. |
| Document links, source context and whitespace | Prior proposal checks passed; packet assembly checks all embedded artifact bodies against source and each selected context line against the schema. | Document integrity only. |
| Live read-only column/FK/count recon and app/direct check | Performed 10 September; results embedded in section 4. Not refreshed during packet preparation. | Real metadata/aggregate evidence; no migration execution. |
| prisma migrate status | Previously passed: 107 migrations up to date. Not rerun for this packet. | Bookkeeping status, not full schema parity; missing Shop tables demonstrate that distinction. |

**Not performed:** executing this SQL anywhere (including a rollback transaction), migration replay against PostgreSQL, RLS role tests, transactional/concurrency/deletion fixtures for these new tables, feature handler/browser tests, immutable answer/resume tests, live-model evaluations, a feature build, target application, or deployment. None of those is implied by “validated.” The two-table draft selection feature itself is not implemented yet.

### Additional artifacts and decisions needed

1. An executable disposable-PostgreSQL migration harness and fixtures, including effective RLS roles, replay, rollback, duplicate conflicts, cross-row mismatch rejection in services, and complete deletion cascades. A concrete disposable target/connection safety guard must distinguish it from the configured application target; provision no external paid service by implication.
2. A chosen timestamped migration directory and exact canonical patch installation plan with a checksum-backed schema backup and postflight checks. No migration folder is active yet. Recheck target absence/definitions; CREATE IF NOT EXISTS is not a substitute.
3. Draft-selection API/UI contracts implementing the shared behavior, version conflicts, confirmed-room merge, private-note preservation, source deletion and ownership-transfer handling. No automatic attribution transfer is approved; until a separately reviewed transfer exists, mismatched publisher context must require review and be ineligible.
4. Separately reviewed scheduled-question/immutable-answer schema, SQL, idempotency and canonical-pointer transaction contract, including history retention/deletion semantics and confirmed reuse. These are required for the complete interview milestone but are not silently included in this migration approval.
5. The complete milestone regression suite, curated semantic evaluation cases/results, mobile/browser evidence and a server-enforced default-off exposure control. An exact rollout/deploy decision remains separate. No isolated toggle should ship as “Spotlight complete.”
6. Explicit authorization level(s) below. The old summary's broad phrase “approve the batch” should not be read as approval for every downstream action. This packet requests review, not an immediate yes/no action.

### Exact approval scope

The reviewable schema batch is precisely the complete models.prisma, inverse-fields.txt, schema.patch and migration.sql embedded in section 2 at the hashes in section 1: two draft tables; seven inverse fields in User, Organization, Project, Product, Room and ProductTag; eight FKs; nine indexes; four CHECKs; RLS on the new tables. No existing-table column changes, data backfill, automatic selection, public activation, Shop repair, later question/answer/publication schemas, social exports, vendor collaboration, external messages or deploy is included.

Approve the following levels explicitly, separately or by naming a specific combination; none is currently authorized by this review-materials request:

| Level | What that authorization permits | What it does not permit |
|---|---|---|
| A — Edit schema/migration files | Back up canonical schema, install the exact reviewed Prisma changes and SQL in one timestamped migration folder, run local format/validate/generate and static guards. Formatting-only alignment may occur; semantic changes return to review. | SQL execution in any database, target application, feature exposure or deployment. |
| B — Test in a disposable database | With an explicitly identified, safely isolated disposable PostgreSQL target, install faithful prerequisite fixtures, execute/replay the exact migration and run migration/RLS/transaction tests. | Any writes to the configured application database, production credentials/data reuse, paid infrastructure provisioning or deployment. |
| C — Apply to the configured target | After A/B pass and fresh target/definition verification, execute only this reviewed migration through the guarded workflow against the configured application/direct target audited on 10 September. Report backup, migration status and structural postflight. | Deployed-environment equivalence, deploying code, backfilling designer data, later schema changes or exposing the feature. If target binding differs, obtain a new concrete target approval. |
| D — Deploy or expose | Requires a later explicit deployment/rollout approval identifying environment, application commit, test evidence and exposure control, after the complete private interview milestone passes. | Not requested in the current two-table batch; never inferred from A, B or C. |

### Proposed post-approval execution sequence

1. Confirm the exact approved levels and artifact hashes. Fetch/sync/rebaseline before implementation; if source drift changes the patch or target definition, prepare the changed review first. No current request grants that implementation step.
2. Under A, take a checksum-backed canonical schema backup and install exactly the reviewed additions/SQL. Run format, validate, generate, schema-diff and migration-discipline checks. If pre-apply validation fails, restore the schema backup and stop to diagnose. Do not fix unrelated schema drift opportunistically.
3. Under B, run the exact migration twice against a named disposable database, inspect actual FK/index/CHECK/RLS definitions, verify rollback and all selection/deletion/concurrency/security fixtures. Differentiate SQL-only results from handler integration. If the harness or database is unavailable, report B as unrun and stop before C rather than claiming static checks are enough.
4. Under C, reverify that the configured application/direct target is the intended destination, refresh the necessary read-only schema/bookkeeping checks, capture the approved backup/checksums and ensure no unexpected new tables/indexes exist. Apply the reviewed transaction through the repository's guarded workflow. Never mark an unapplied migration resolved as applied; investigate any failed bookkeeping before retry. Verify actual constraints/indexes/RLS, zero new source rows immediately after the storage-only apply and final migration status. Do not claim deployed production verification.
5. After successful application, an application rollback keeps unused additive tables. Do not drop populated selections. A canonical schema file restore does not undo a committed database migration; reconcile and report both states before further action.
6. Obtain separate reviews for the follow-on scheduled-question/answer-revision storage, implement the complete private tagging → interview → saved-answer flow behind the exposure control and finish section 7's tests. This is the next milestone, not an expansion of this migration.
7. Only a later D authorization may deploy/expose an identified tested application commit. This packet and any A/B/C approval alone do not authorize deployment, public surfaces or external messages.
