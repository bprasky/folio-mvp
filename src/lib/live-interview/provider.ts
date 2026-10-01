import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { FOLIO_INTERVIEWER_PERSONA } from '@/lib/interview/prompts/persona';
import { LiveError, liveConfig } from './config';

const API = 'https://tavusapi.com/v2';
/** Errors deliberately exclude provider response bodies, credentials and private transcript data. */
export class ProviderError extends Error {
  constructor(public ambiguous: boolean, public status?: number) { super('The live provider request could not be confirmed.'); }
}
export async function tavusRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const key = process.env.TAVUS_API_KEY;
  if (!key) throw new LiveError('Tavus is not configured.', 503);
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { method, headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  } catch { throw new ProviderError(true); }
  if (!response.ok) throw new ProviderError(response.status >= 500 || response.status === 408, response.status);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  try { return JSON.parse(text) as T; } catch { throw new ProviderError(true); }
}
export function backendHash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function encryptionKey() {
  if (!process.env.NEXTAUTH_SECRET) throw new LiveError('Session encryption is not configured.', 503);
  return createHash('sha256').update(`folio-live-join:${process.env.NEXTAUTH_SECRET}`).digest();
}
export function sealJoin(value: unknown) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function openJoin(value: string) {
  const bytes = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()) as {url: string; token: string; conversationId: string};
}
export function palBody(id: string, credential: string) {
  const config = liveConfig();
  return { pal_name: `folio-${id}`, pipeline_mode: 'full', default_face_id: config.faceId,
    system_prompt: FOLIO_INTERVIEWER_PERSONA, greeting: '', dynamic_greeting: false,
    disclosure_type: 'off', // Folio supplies persistent, visible AI disclosure before joining.
    layers: { perception: { perception_model: 'off' }, llm: { model: 'folio-interview',
      base_url: `${config.baseUrl}/api/live-interviews/provider/${id}/v1`, api_key: credential, speculative_inference: false } } };
}
export function conversationBody(id: string, palId: string, question: string) {
  const config = liveConfig();
  return { pal_id: palId, face_id: config.faceId, conversation_name: `folio-${id}`,
    custom_greeting: question, dynamic_greeting: false, require_auth: true, max_participants: 2,
    participant_tags: [], properties: { max_call_duration: config.duration,
      participant_absent_timeout: 90, participant_left_timeout: 30, enable_closed_captions: true } };
}
export interface ProviderConversation { conversation_id: string; conversation_name?: string; conversation_url: string; meeting_token?: string; pal_id: string; status: string }
export async function createPal(id: string, credential: string) {
  const result = await tavusRequest<{pal_id: string}>('/pals', 'POST', palBody(id, credential));
  if (!result?.pal_id) throw new ProviderError(true);
  return result.pal_id;
}
export async function createConversation(id: string, palId: string, question: string) {
  const result = await tavusRequest<ProviderConversation>('/conversations', 'POST', conversationBody(id, palId, question));
  if (!result?.conversation_id || !result.meeting_token) throw new ProviderError(true);
  const url = new URL(result.conversation_url);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.daily.co') || url.username || url.password) throw new ProviderError(true);
  return result;
}
export const getConversation = (id: string) => tavusRequest<ProviderConversation>(`/conversations/${encodeURIComponent(id)}`);
export const endConversation = (id: string) => tavusRequest<void>(`/conversations/${encodeURIComponent(id)}/end`, 'POST');
export const deletePal = (id: string) => tavusRequest<void>(`/pals/${encodeURIComponent(id)}`, 'DELETE');
/** Reconcile uncertain creates by unique server-owned name. Never repeat a paid POST. */
export async function findConversations(id: string) {
  const found: ProviderConversation[] = [];
  for (let page = 1; page <= 20; page++) {
    const result = await tavusRequest<{data: ProviderConversation[]; total_count: number}>(`/conversations?limit=100&page=${page}`);
    found.push(...result.data.filter(c => c.conversation_name === `folio-${id}`));
    if (page * 100 >= result.total_count) return found;
  }
  throw new LiveError('Provider reconciliation requires operator review; no additional call was created.', 503);
}
export async function findPals(id: string) {
  const found: string[] = [];
  for (let page = 1; page <= 20; page++) {
    const result = await tavusRequest<{data: Array<{pal_id: string; pal_name: string}>; total_count: number}>(`/pals?limit=100&page=${page}`);
    found.push(...result.data.filter(p => p.pal_name === `folio-${id}`).map(p => p.pal_id));
    if (page * 100 >= result.total_count || result.data.length < 100) return found;
  }
  throw new LiveError('PAL reconciliation requires operator review.', 503);
}
