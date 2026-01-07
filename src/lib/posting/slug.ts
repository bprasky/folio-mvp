import { slugify } from "@/lib/urls";
import { customAlphabet } from "nanoid";

const nano = customAlphabet("346789ABCDEFGHJKLMNPQRTUVWXY", 6);

export function makeSlug(title?: string, fallbackId?: string): string {
  const base = (title && slugify(title)) || fallbackId || "project";
  return `${base}-${nano()}`;
}
