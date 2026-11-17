import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { absolutePublicUrl } from './public';
import { publishedProjectHref } from '@/lib/post/published-story-href';

export const SITEMAP_SIZE = 1000;
export const SITEMAP_KINDS = ['projects', 'people', 'studios'] as const;
export type SitemapKind = typeof SITEMAP_KINDS[number];
export const sitemapProjectWhere = (): Prisma.ProjectWhereInput => ({ isPublic: true, publishedAt: { lte: new Date() },
  OR: [{ post: { is: { status: 'PUBLISHED' } } }, ...(process.env.FOLIO_EDITORIAL_CHANNELS === 'true' ? [{ portfolioPublishedAt: { not: null } }] : [])] });
const peopleWhere = (): Prisma.UserWhereInput => ({ accountStatus: 'APPROVED', OR: [
  { designerProjects: { some: sitemapProjectWhere() } }, { profileInterview: { is: { status: 'PUBLISHED' } } },
  { bio: { not: '' }, AND: [{ bio: { not: null } }], organizationUsers: { some: { isActive: true } } },
] });
const studiosWhere = (): Prisma.OrganizationWhereInput => ({ OR: [
  { designerProjects: { some: sitemapProjectWhere() } },
  { description: { not: '' }, AND: [{ description: { not: null } }], users: { some: { isActive: true } } },
] });
export async function sitemapCounts() {
  const [projects, people, studios] = await Promise.all([
    prisma.project.count({ where: sitemapProjectWhere() }), prisma.user.count({ where: peopleWhere() }), prisma.organization.count({ where: studiosWhere() }),
  ]);
  return { projects, people, studios };
}
export async function sitemapUrls(kind: SitemapKind, page: number): Promise<string[]> {
  const pagination = { orderBy: { id: 'asc' as const }, skip: page * SITEMAP_SIZE, take: SITEMAP_SIZE };
  if (kind === 'projects') {
    const projects = await prisma.project.findMany({ where: sitemapProjectWhere(), ...pagination,
      select: { id: true, isPublic: true, publishedAt: true, portfolioPublishedAt: true, post: { select: { slug: true, status: true } } } });
    return projects.flatMap(project => { const href = publishedProjectHref(project);
      if (!href) return [];
      return [absolutePublicUrl(href), ...(process.env.FOLIO_EDITORIAL_CHANNELS === 'true' && project.post?.status === 'PUBLISHED'
        ? [absolutePublicUrl(`/p/${encodeURIComponent(project.post.slug)}/feature`)] : [])]; });
  }
  if (kind === 'people') return (await prisma.user.findMany({ where: peopleWhere(), ...pagination, select: { id: true } })).map(user => absolutePublicUrl(`/profile/${encodeURIComponent(user.id)}`));
  return (await prisma.organization.findMany({ where: studiosWhere(), ...pagination, select: { id: true } })).map(org => absolutePublicUrl(`/org/${encodeURIComponent(org.id)}`));
}
export const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export function sitemapXml(urls: string[], index = false) {
  const root = index ? 'sitemapindex' : 'urlset', element = index ? 'sitemap' : 'url';
  return `<?xml version="1.0" encoding="UTF-8"?><${root} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<${element}><loc>${xmlEscape(url)}</loc></${element}>`).join('')}</${root}>`;
}
export const sitemapHeaders = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' };
