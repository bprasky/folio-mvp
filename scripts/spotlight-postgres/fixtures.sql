-- Synthetic identity/relationship skeleton only. Not an application bootstrap.
-- TEXT keys and relevant FK/delete paths from the reviewed canonical schema.
CREATE TABLE public.users (id TEXT PRIMARY KEY);
CREATE TABLE public.organizations (id TEXT PRIMARY KEY);
CREATE TABLE public.projects (
  id TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  "designerId" TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  "designerOrgId" TEXT REFERENCES public.organizations(id) ON DELETE SET NULL
);
CREATE TABLE public.products (id TEXT PRIMARY KEY);
CREATE TABLE public.rooms (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
);
CREATE TABLE public.project_images (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  "roomId" TEXT REFERENCES public.rooms(id) ON DELETE SET NULL
);
CREATE TABLE public.product_tags (
  id TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  "imageId" TEXT NOT NULL REFERENCES public.project_images(id) ON DELETE CASCADE
);
INSERT INTO public.users VALUES ('owner'), ('publisher'), ('selector'), ('other-publisher');
INSERT INTO public.organizations VALUES ('studio'), ('other-studio');
INSERT INTO public.projects VALUES ('project', 'owner', 'publisher', 'studio'), ('other-project', 'owner', NULL, NULL);
INSERT INTO public.products VALUES ('product'), ('other-product');
INSERT INTO public.rooms VALUES ('room', 'project'), ('other-room', 'other-project');
INSERT INTO public.project_images VALUES ('photo-a', 'project', 'room'), ('photo-b', 'project', 'room'), ('other-photo', 'other-project', 'other-room');
INSERT INTO public.product_tags VALUES ('tag-a', 'product', 'photo-a'), ('tag-b', 'product', 'photo-b'), ('other-tag', 'other-product', 'other-photo');
