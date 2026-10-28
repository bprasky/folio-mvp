import { z } from 'zod';

const AccentSchema = z.string().regex(/^#[0-9a-f]{6}$/i).transform(value => value.toUpperCase()).nullable();
const RoomOrderSchema = z.array(z.string().min(1).max(200)).max(500)
  .refine(ids => new Set(ids).size === ids.length, 'Rooms must not be repeated.');

/** These preferences belong to the designer, never to editorial generation. */
export const PresentationSchema = z.object({
  version: z.literal(1),
  accent: AccentSchema,
  roomOrder: RoomOrderSchema,
}).strict();

export type Presentation = z.infer<typeof PresentationSchema>;

export const PresentationPatchSchema = z.object({
  accent: AccentSchema.optional(),
  roomOrder: RoomOrderSchema.optional(),
}).strict().refine(value => value.accent !== undefined || value.roomOrder !== undefined, 'Choose a color or room order.');

/** Explicit allowlist: extra saved JSON never crosses the public boundary. */
export function readPresentation(value: unknown): Presentation {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const parsed = PresentationSchema.safeParse({ version: candidate.version, accent: candidate.accent, roomOrder: candidate.roomOrder });
  return parsed.success ? parsed.data : { version: 1, accent: null, roomOrder: [] };
}

/** A full prose replacement must keep the freshest designer-owned choices. */
export function preservePresentation<T extends Record<string, unknown>>(next: T, previous: unknown): T & { presentation: Presentation } {
  const saved = previous && typeof previous === 'object' ? (previous as Record<string, unknown>).presentation : undefined;
  return { ...next, presentation: readPresentation(saved) };
}

/** Darken only the surface tint, never the photo. White text stays legible for every swatch. */
export function presentationTokens(accent: string | null | undefined): { background: string; text: string; glass: string } {
  const color = AccentSchema.safeParse(accent ?? null);
  const rgb = color.success && color.data
    ? [1, 3, 5].map(start => Math.round(parseInt(color.data!.slice(start, start + 2), 16) * 0.26))
    : [36, 34, 32];
  return { background: `rgb(${rgb.join(', ')})`, text: '#FFFFFF', glass: `rgba(${rgb.join(', ')}, 0.74)` };
}

/** Dominant, visibly distinct colors from equally sized RGB photo samples. No invented fallback. */
export function primaryPhotoColors(samples: readonly Uint8Array[], limit = 6): string[] {
  const bins = new Map<string, { count: number; red: number; green: number; blue: number }>();
  for (const pixels of samples) {
    for (let i = 0; i + 2 < pixels.length; i += 3) {
      const [red, green, blue] = [pixels[i], pixels[i + 1], pixels[i + 2]];
      const key = [red, green, blue].map(value => Math.floor(value / 32)).join(',');
      const bin = bins.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
      bin.count++; bin.red += red; bin.green += green; bin.blue += blue;
      bins.set(key, bin);
    }
  }
  const colors: number[][] = [];
  for (const bin of Array.from(bins.values()).sort((a, b) => b.count - a.count)) {
    const rgb = [bin.red, bin.green, bin.blue].map(value => Math.round(value / bin.count));
    if (colors.some(other => Math.hypot(...rgb.map((value, i) => value - other[i])) < 55)) continue;
    colors.push(rgb);
    if (colors.length >= limit) break;
  }
  return colors.map(rgb => '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase());
}
