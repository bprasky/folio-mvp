import { z } from 'zod';

// tiny helper: allow undefined/null for optional strings
const nullishDataUrl = z.string().startsWith('data:').nullish();
const nullishUrl = z.string().url().nullish();

// Accept either `name` or `title` from clients; normalize later to `title`
export const FestivalInput = z.object({
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1),
  location: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  imageDataUrl: nullishDataUrl,
  imageUrl: nullishUrl,
  // accept file from multipart; keep type loose to avoid Node/File runtime quirks
  imageFile: z.any().optional(),
})
  .refine(v => v.title || v.name, { message: 'title (or name) is required', path: ['title'] })
  .refine(v => v.endDate >= v.startDate, { message: 'endDate must be >= startDate', path: ['endDate'] })
  .refine(v => !!v.imageFile || !!v.imageDataUrl || !!v.imageUrl || process.env.FOLIO_ALLOW_CREATE_WITHOUT_IMAGE === 'true', {
    message: 'image required (or enable FOLIO_ALLOW_CREATE_WITHOUT_IMAGE)',
    path: ['image']
  });

export const EventInput = z.object({
  title: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().min(1),
  location: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  eventType: z.string().optional(), // mapped to your enum later; default OTHER
  imageDataUrl: nullishDataUrl,
  imageUrl: nullishUrl,
  imageFile: z.any().optional(),
})
  .refine(v => v.title || v.name, { message: 'title (or name) is required', path: ['title'] })
  .refine(v => v.endDate >= v.startDate, { message: 'endDate must be >= startDate', path: ['endDate'] });
