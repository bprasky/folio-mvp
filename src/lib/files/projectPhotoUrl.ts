export const PROJECT_PHOTO_PREFIX = '/api/project-photos/';

export function protectedPhotoUrl(path: string): string {
  return PROJECT_PHOTO_PREFIX + path.split('/').map(encodeURIComponent).join('/');
}

export function parseProtectedPhotoUrl(url: string): { projectId: string; path: string } | null {
  if (!url.startsWith(PROJECT_PHOTO_PREFIX)) return null;
  try {
    const parts = url.slice(PROJECT_PHOTO_PREFIX.length).split('/').map(decodeURIComponent);
    if (parts.length < 2 || parts.some(part => !part || part === '.' || part === '..' || /[/\\?#\u0000]/.test(part))) return null;
    if (!/^[a-f0-9-]{36}$/i.test(parts[0])) return null;
    const path = parts.join('/');
    return protectedPhotoUrl(path) === url ? { projectId: parts[0], path } : null;
  } catch { return null; }
}
