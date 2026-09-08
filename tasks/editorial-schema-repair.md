# Mapping-only repair awaiting schema approval

No SQL, migration, data update, column rename, or backfill. Metadata and recorded
migration agree. These three replacement blocks map Prisma field names to the
existing database names. Back up schema before applying and restore on validation
failure. The explicit unique-index map preserves the existing index name.

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
