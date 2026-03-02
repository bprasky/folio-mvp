/**
 * Shared Prisma where-clause filters for consistent querying across the app.
 *
 * A project is considered "published" if ANY of these conditions hold:
 *   - isPublic: true
 *   - publishedAt is set
 *   - status === 'published'
 */
export const PUBLISHED_PROJECT_FILTER = {
  OR: [
    { isPublic: true },
    { publishedAt: { not: null } },
    { status: 'published' },
  ],
} as const;
