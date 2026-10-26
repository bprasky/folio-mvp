/** Serialize intake writes so Save draft, autosave and Continue share one project. */
export function createProjectDraftWriter(request: typeof fetch = fetch) {
  let id: string | null = null;
  let pending: Promise<string> | null = null;

  return (payload: Record<string, unknown>): Promise<string> => {
    // Capture the submitted values now, not when an earlier write finishes.
    const snapshot = structuredClone(payload);
    const write = async () => {
      const response = await request('/api/projects', {
        method: id ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { ...snapshot, id } : snapshot),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || data?.error || 'Could not save project.');
      if (typeof data?.id !== 'string' || !data.id || (id && data.id !== id)) {
        throw new Error('The server did not confirm the saved project.');
      }
      id = data.id;
      return data.id as string;
    };
    // A failed update must not poison later retries or forget the existing ID.
    pending = pending ? pending.then(write, write) : write();
    return pending;
  };
}
