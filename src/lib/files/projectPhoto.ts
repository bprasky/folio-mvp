// Keep raw uploads below the hosted JSON request limit after base64 expansion.
export const PROJECT_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const PROJECT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function projectPhotoError(type: string, size: number): string | null {
  if (!PROJECT_PHOTO_TYPES.includes(type)) return 'Use JPEG, PNG or WebP photographs.';
  if (size > PROJECT_PHOTO_MAX_BYTES) return 'Choose photographs no larger than 3 MB.';
  if (!size) return 'This photograph is empty. Choose another file.';
  return null;
}
