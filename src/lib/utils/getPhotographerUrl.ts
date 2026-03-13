/**
 * Generate the canonical profile URL for a photographer.
 * Matches the username resolution logic in /photographer/[username]/page.tsx
 */
export function getPhotographerUrl(user: { name: string }): string {
  const slug = user.name.replace(/\s+/g, '').toLowerCase();
  return `/photographer/${slug}`;
}
