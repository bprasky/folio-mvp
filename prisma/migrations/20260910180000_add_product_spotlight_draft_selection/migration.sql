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
