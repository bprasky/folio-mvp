-- CreateTable
CREATE TABLE "editorial_category" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "centroid" vector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editorial_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editorial_assignment" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "editorial_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "editorial_score" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editorial_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editorial_edition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "category_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "project_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "published_at" TIMESTAMP(3),
    "metrics" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editorial_edition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "editorial_category_type_label_key" ON "editorial_category"("type", "label");

-- CreateIndex
CREATE INDEX "editorial_category_type_idx" ON "editorial_category"("type");

-- CreateIndex
CREATE UNIQUE INDEX "editorial_assignment_project_category_unique" ON "editorial_assignment"("project_id", "category_id");

-- CreateIndex
CREATE INDEX "editorial_assignment_category_id_idx" ON "editorial_assignment"("category_id");

-- CreateIndex
CREATE INDEX "editorial_assignment_editorial_id_idx" ON "editorial_assignment"("editorial_id");

-- CreateIndex
CREATE UNIQUE INDEX "editorial_edition_slug_key" ON "editorial_edition"("slug");

-- AddForeignKey
ALTER TABLE "editorial_assignment" ADD CONSTRAINT "editorial_assignment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_assignment" ADD CONSTRAINT "editorial_assignment_editorial_id_fkey" FOREIGN KEY ("editorial_id") REFERENCES "project_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_assignment" ADD CONSTRAINT "editorial_assignment_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "editorial_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;


