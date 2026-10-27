import { workflowRequest } from '@/lib/client/workflowRequest';

/** Serialize intake writes and retain the original create across uncertain replies. */
export function createProjectDraftWriter(request: typeof fetch = workflowRequest, storageKey?: string) {
  let id: string | null = null;
  let pending: Promise<string> | null = null;
  let creation: { requestId: string; payload: Record<string, unknown> } | null = null;
  try { if (storageKey) creation = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch { /* Storage may be disabled. */ }
  const persist = () => {
    try { if (storageKey) { if (creation) sessionStorage.setItem(storageKey, JSON.stringify(creation)); else sessionStorage.removeItem(storageKey); } } catch { /* The mounted form still retains identity. */ }
  };
  return (payload: Record<string, unknown>): Promise<string> => {
    const snapshot = structuredClone(payload);
    const send = async (method: 'POST' | 'PUT', body: Record<string, unknown>) => {
      const response = await request('/api/projects', { method, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        // Validation never committed. Allow corrected fields on the next attempt.
        if (method === 'POST' && [400, 422].includes(response.status)) { creation = null; persist(); }
        throw new Error(data?.message || data?.error || 'Could not save project.');
      }
      if (typeof data?.id !== 'string' || !data.id || (id && data.id !== id)) throw new Error('The server did not confirm the saved project.');
      id = data.id;
      return data.id as string;
    };
    const write = async () => {
      if (!id) {
        if (!creation) { creation = { requestId: crypto.randomUUID(), payload: snapshot }; persist(); }
        const initial = creation.payload;
        await send('POST', { ...initial, requestId: creation.requestId });
        creation = null; persist();
        // Resolve an uncertain creation before applying newer entered fields.
        if (JSON.stringify(initial) === JSON.stringify(snapshot)) return id!;
      }
      return send('PUT', { ...snapshot, id });
    };
    pending = pending ? pending.then(write, write) : write();
    return pending;
  };
}
