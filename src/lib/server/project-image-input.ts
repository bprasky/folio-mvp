import { safeProductResource, parseProductUrl } from './safe-product-url';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 16384;
export class ImageInputError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

/** Bound the JSON body before parsing/base64 allocation; Content-Length is not trusted. */
export async function readImageBody(request: Request): Promise<any> {
  const reader = request.body?.getReader();
  if (!reader) throw new ImageInputError('Choose a photograph to upload.');
  const chunks: Uint8Array[] = []; let size = 0; let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel(); }, 15000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel(); throw new ImageInputError('Choose a photo smaller than 8 MB.', 413);
      }
      chunks.push(value);
    }
    if (timedOut) throw new ImageInputError('Photo upload timed out. Please retry.', 408);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch (error) {
    if (error instanceof ImageInputError) throw error;
    throw new ImageInputError('The upload could not be read. Please retry.');
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

export function decodeImage(input: unknown): Buffer {
  if (typeof input !== 'string' || !input.length || input.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 ||
      input.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input)) {
    throw new ImageInputError('Choose a valid photo smaller than 8 MB.');
  }
  const bytes = Buffer.from(input, 'base64');
  if (bytes.length > MAX_IMAGE_BYTES) throw new ImageInputError('Choose a photo smaller than 8 MB.', 413);
  return bytes;
}

/** DNS is checked and pinned by the existing safe transport, on every redirect. */
export async function fetchProjectImage(input: string): Promise<{ buffer: Buffer; mime: string }> {
  let url = parseProductUrl(input).href;
  const deadline = Date.now() + 15000;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ImageInputError('Photo download timed out. Please retry.', 408);
    const response = await safeProductResource(url, { maxBytes: MAX_IMAGE_BYTES, timeoutMs: remaining, accept: 'image/*' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.headers.location) break;
      url = parseProductUrl(new URL(response.headers.location, url).href).href;
      continue;
    }
    const mime = response.headers['content-type']?.split(';')[0].trim().toLowerCase();
    if (response.status < 200 || response.status >= 300 || !mime?.startsWith('image/') || !response.body.length) break;
    return { buffer: response.body, mime };
  }
  throw new ImageInputError('This photo could not be imported. Upload the file or try another link.');
}
