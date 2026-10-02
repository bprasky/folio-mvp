import 'server-only';

export class LiveError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export const CAPTURE_CONSENT_VERSION = '2026-10-01';
export const CAPTURE_DISCLOSURE = 'Live speech is processed by Tavus and transcribed by Folio. Optional creator recordings are stored privately for media review. Capture consent does not approve publication.';
export type CaptureMode = 'none' | 'audio' | 'video';
function bounded(name: string, fallback: number, max: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > max) throw new LiveError(`Invalid ${name} configuration.`, 503);
  return value;
}
export function liveEnabled(actorId: string) {
  return process.env.FOLIO_LIVE_INTERVIEWS === '1'
    && (process.env.FOLIO_LIVE_ALLOWLIST ?? '').split(',').map(s => s.trim()).filter(Boolean).includes(actorId);
}
export function recordingEnabled() { return process.env.FOLIO_INTERVIEW_RECORDING === '1'; }
export function liveConfig() {
  let base: URL;
  try { base = new URL(process.env.FOLIO_LIVE_BASE_URL ?? ''); }
  catch { throw new LiveError('Configure FOLIO_LIVE_BASE_URL with the reachable HTTPS Folio origin.', 503); }
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash)
    throw new LiveError('FOLIO_LIVE_BASE_URL must be an HTTPS origin without a path.', 503);
  if (!process.env.TAVUS_API_KEY || !process.env.NEXTAUTH_SECRET) throw new LiveError('Live provider credentials are not configured.', 503);
  return { baseUrl: base.origin, faceId: process.env.TAVUS_FACE_ID || 'rc9cff32ceba',
    duration: bounded('FOLIO_LIVE_MAX_SECONDS', 1800, 3600),
    maxActive: bounded('FOLIO_LIVE_MAX_CONCURRENT', 3, 20),
    maxDailyActor: bounded('FOLIO_LIVE_MAX_DAILY_PER_ACTOR', 20, 30) };
}

/** Applied only to browser mutations. The separate machine route authenticates a bearer credential. */
export function assertLiveOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const allowed = new Set([new URL(request.url).origin]);
  for (const value of [process.env.NEXTAUTH_URL, process.env.FOLIO_LIVE_BASE_URL]) {
    if (value) { try { allowed.add(new URL(value).origin); } catch { /* invalid config is not an allowed origin */ } }
  }
  if (!origin || !allowed.has(origin) || request.headers.get('sec-fetch-site') === 'cross-site')
    throw new LiveError('This request must come from the Folio interview page.', 403);
}
