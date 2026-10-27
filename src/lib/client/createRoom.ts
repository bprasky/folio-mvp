import { workflowRequest } from './workflowRequest';

const pending = new Map<string, string>();

/** Keep an uncertain operation through modal remount/refresh. A confirmed next
 * creation gets a new ID, including when its name is identical. The server also
 * scopes each ID to the authenticated actor and project. */
export async function createRoom({ projectId, name, type }: { projectId: string; name: string; type?: string | null }) {
  const key = `folio:room-create:${JSON.stringify([projectId, name.trim(), type || null])}`;
  let requestId = pending.get(key);
  try { requestId ||= sessionStorage.getItem(key) || undefined; } catch { /* optional persistence */ }
  requestId ||= crypto.randomUUID();
  pending.set(key, requestId);
  try { sessionStorage.setItem(key, requestId); } catch { /* mounted retry remains safe */ }
  const response = await workflowRequest(`/api/projects/${encodeURIComponent(projectId)}/rooms`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, requestId }),
  });
  const room = await response.json();
  if (!response.ok) throw new Error(room.error || 'Could not create room. Retry to confirm the saved room.');
  if (!room.id) throw new Error('The server did not confirm the room. Retry to check.');
  pending.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* optional persistence */ }
  return { ok: true, room };
}
