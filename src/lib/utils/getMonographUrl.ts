/**
 * Generate the canonical monograph URL for a designer.
 * Matches the username resolution logic in /monograph/[username]/page.tsx
 */
export function getMonographUrl(user: { name: string }): string {
  const slug = user.name.replace(/\s+/g, '').toLowerCase();
  return `/monograph/${slug}`;
}
