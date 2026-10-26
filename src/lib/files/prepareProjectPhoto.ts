import { PROJECT_PHOTO_MAX_BYTES, PROJECT_PHOTO_TYPES } from './projectPhoto';

export const ORIGINAL_PHOTO_MAX_BYTES = 32 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
export function originalPhotoError(type: string, size: number): string | null {
  if (!PROJECT_PHOTO_TYPES.includes(type)) return 'Use JPEG, PNG or WebP photographs.';
  if (!size) return 'This photograph is empty. Choose another file.';
  if (size > ORIGINAL_PHOTO_MAX_BYTES) return 'Choose an original under 32 MiB, or export a smaller copy.';
  return null;
}

/** Inspect the encoded dimensions before allocating a decoded bitmap. */
export function photoDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number) => String.fromCharCode(...Array.from(bytes.subarray(offset, offset + length)));
  let width = 0, height = 0;
  if (bytes.length >= 24 && ascii(1, 3) === 'PNG') {
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = view.getUint16(offset);
      if (length < 2) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
      }
      offset += length;
    }
  } else if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const kind = ascii(12, 4);
    if (kind === 'VP8X') {
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (kind === 'VP8L' && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
    } else if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff;
    }
  }
  if (!width || !height) throw new Error('This photograph could not be read. Export it as JPEG, PNG or WebP and try again.');
  if (width * height > MAX_PIXELS || Math.max(width, height) > 16000) throw new Error('This photograph exceeds 40 megapixels. Export a smaller copy before uploading.');
  return { width, height };
}

type Prepared = { file: File; notice?: string; width: number; height: number };
const prepared = new WeakMap<File, Promise<Prepared>>();

export function prepareProjectPhoto(file: File): Promise<Prepared> {
  const existing = prepared.get(file);
  if (existing) return existing;
  const result = prepare(file).catch(error => { prepared.delete(file); throw error; });
  prepared.set(file, result);
  return result;
}

async function prepare(file: File): Promise<Prepared> {
  const error = originalPhotoError(file.type, file.size);
  if (error) throw new Error(error);
  const dimensions = photoDimensions(new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer()));
  if (file.size <= PROJECT_PHOTO_MAX_BYTES) return { file, ...dimensions };
  let expired = false;
  let timer: ReturnType<typeof setTimeout>;
  const conversion = async (): Promise<Prepared> => {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const canvas = document.createElement('canvas');
    try {
      if (expired) throw new Error('Photo preparation timed out. Try a smaller exported copy.');
      for (const edge of [3200, 2560, 2048, 1600]) {
        const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('This browser could not prepare the photo. Try another browser or a smaller copy.');
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingQuality = 'high'; context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare this photo.')), 'image/jpeg', 0.9));
        if (expired) throw new Error('Photo preparation timed out. Try a smaller exported copy.');
        if (blob.size <= PROJECT_PHOTO_MAX_BYTES) return {
          file: new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified }),
          width: canvas.width, height: canvas.height,
          notice: `${file.name}: prepared a ${canvas.width} × ${canvas.height} JPEG copy for upload. Your original is unchanged.`,
        };
      }
      throw new Error('This photograph could not fit the upload limit at editorial quality. Export a smaller copy.');
    } finally { bitmap.close(); canvas.width = 0; canvas.height = 0; }
  };
  try {
    return await Promise.race([conversion(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(new Error('Photo preparation timed out. Try a smaller exported copy.')); }, 30_000);
    })]);
  } finally { clearTimeout(timer!); }
}
