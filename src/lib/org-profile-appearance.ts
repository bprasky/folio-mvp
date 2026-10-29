import { z } from 'zod';
import type { CSSProperties } from 'react';

export const PROFILE_FACTS = [
  { key: 'years', label: 'Years in business' },
  { key: 'completed', label: 'Projects completed' },
  { key: 'location', label: 'Based in' },
  { key: 'founded', label: 'Established' },
  { key: 'focus', label: 'Project focus' },
  { key: 'region', label: 'Where we work' },
  { key: 'team', label: 'Studio size' },
  { key: 'countries', label: 'Countries worked in' },
  { key: 'awards', label: 'Awards' },
  { key: 'press', label: 'Press features' },
  { key: 'folio', label: 'Projects on Folio' },
  { key: 'languages', label: 'Languages' },
  { key: 'availability', label: 'Availability' },
  { key: 'specialty', label: 'Specialty' },
] as const;

const factKey = z.enum(['years', 'completed', 'location', 'founded', 'focus', 'region', 'team', 'countries', 'awards', 'press', 'folio', 'languages', 'availability', 'specialty']);
export type ProfileFactKey = z.infer<typeof factKey>;
const imageUrl = z.string().max(2048).url().refine(value => {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Use a secure image URL.');

export const orgProfileAppearanceSchema = z.object({
  version: z.literal(1),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Choose a valid color.').nullable(),
  introduction: z.string().trim().max(360).nullable(),
  cover: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('auto') }).strict(),
    z.object({ kind: z.literal('none') }).strict(),
    z.object({ kind: z.literal('project'), imageId: z.string().uuid() }).strict(),
    z.object({ kind: z.literal('upload'), url: imageUrl }).strict(),
  ]),
  coverPosition: z.object({ x: z.number().int().min(0).max(100), y: z.number().int().min(0).max(100) }).strict(),
  identity: z.object({ mode: z.enum(['logo', 'portrait', 'initials']), url: imageUrl.nullable() }).strict(),
  facts: z.array(z.object({ key: factKey, value: z.string().trim().max(48) }).strict()).max(4)
    .refine(facts => new Set(facts.map(fact => fact.key)).size === facts.length, 'Choose each fact only once.').nullable(),
}).strict();

export type OrgProfileAppearance = z.infer<typeof orgProfileAppearanceSchema>;
export type ProfileFact = NonNullable<OrgProfileAppearance['facts']>[number];
export type ProfileOrganization = {
  id: string; name: string; type: string; logo: string | null;
  description: string | null; tagline: string | null; location: string | null;
  foundedYear: number | null; specialties: string[]; serviceRegions: string[];
  projectTypes: string[]; teamSizeRange: string | null;
};
export type ProfileCover = { url: string; projectTitle?: string } | null;
export type ProfileProjectChoice = { id: string; title: string; images: { id: string; url: string }[] };
export type OrgAppearanceData = {
  org: ProfileOrganization;
  appearance: OrgProfileAppearance;
  projects: ProfileProjectChoice[];
  projectCount: number;
  cover: ProfileCover;
};

export function defaultOrgAppearance(): OrgProfileAppearance {
  return { version: 1, backgroundColor: null, introduction: null, cover: { kind: 'auto' },
    coverPosition: { x: 50, y: 50 }, identity: { mode: 'logo', url: null }, facts: null };
}

export function readOrgAppearance(value: unknown): OrgProfileAppearance {
  const parsed = orgProfileAppearanceSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultOrgAppearance();
}

export function factSuggestion(key: ProfileFactKey, org: ProfileOrganization, projectCount: number, year: number): string {
  switch (key) {
    case 'years': return org.foundedYear && org.foundedYear <= year ? String(year - org.foundedYear) : '';
    case 'founded': return org.foundedYear ? String(org.foundedYear) : '';
    case 'location': return org.location || '';
    case 'region': return org.serviceRegions.join(', ');
    case 'focus': return org.projectTypes.join(', ');
    case 'specialty': return org.specialties.join(', ');
    case 'folio': return String(projectCount);
    default: return '';
  }
}

export function profileFacts(appearance: OrgProfileAppearance, org: ProfileOrganization, count: number, year: number): ProfileFact[] {
  const facts = appearance.facts ?? (['years', 'location', 'folio'] as const)
    .map(key => ({ key, value: factSuggestion(key, org, count, year).slice(0, 48) }))
    .filter(fact => fact.value && (fact.key !== 'folio' || count > 0));
  return facts.map(fact => fact.key === 'folio' ? { ...fact, value: String(count) } : fact).filter(fact => fact.value);
}

export function profileIntroduction(appearance: OrgProfileAppearance, org: ProfileOrganization): string {
  const text = appearance.introduction ?? org.description ?? org.tagline ?? '';
  if (text.length <= 360) return text;
  const cut = text.slice(0, 357);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceEnd > 120) return cut.slice(0, sentenceEnd + 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 260 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

export function resolveProfileCover(appearance: OrgProfileAppearance, projects: ProfileProjectChoice[]): ProfileCover {
  if (appearance.cover.kind === 'none') return null;
  if (appearance.cover.kind === 'upload') return { url: appearance.cover.url };
  if (appearance.cover.kind === 'project') {
    const imageId = appearance.cover.imageId;
    for (const project of projects) {
      const image = project.images.find(candidate => candidate.id === imageId);
      if (image) return { url: image.url, projectTitle: project.title };
    }
    // A withdrawn photo must disappear, even when a cover selection is saved.
    return null;
  }
  const project = projects.find(candidate => candidate.images.length);
  return project ? { url: project.images[0].url, projectTitle: project.title } : null;
}

export function profilePageStyle(color: string | null): CSSProperties {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return {};
  const channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const ink = luminance > 0.179 ? '#000000' : '#ffffff';
  return { '--org-page-background': color, '--org-page-ink': ink,
    '--org-page-muted': ink, '--org-page-border': `color-mix(in srgb, ${ink} 25%, transparent)` } as CSSProperties;
}
