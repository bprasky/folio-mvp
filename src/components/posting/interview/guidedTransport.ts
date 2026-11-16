import type { GuidedCommand, GuidedProgressEvent, GuidedSession } from '@/lib/interview/guided/types';

type Result = { ok: boolean; status: number; session?: GuidedSession; message?: string; error?: string };

/** The deadline covers headers AND the entire stream; an uncertain save is never retried automatically. */
export async function sendGuidedCommand(endpoint: string, command: GuidedCommand,
  onProgress: (event: GuidedProgressEvent) => void, timeoutMs = 90_000): Promise<Result> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, { method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: JSON.stringify(command) });
    if (response.status === 401) throw new Error('Your session expired. Sign in again, then retry. Your saved work is retained.');
    if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson'))
      return { ...await response.json(), ok: response.ok, status: response.status };
    const reader = response.body?.getReader();
    if (!reader) throw new Error('The reply was interrupted. Your response is retained; retry to check its saved status.');
    let buffer = '';
    const decoder = new TextDecoder();
    let result: Result | undefined;
    const consume = (line: string) => {
      if (!line.trim()) return;
      const event: GuidedProgressEvent = JSON.parse(line);
      if (event.type === 'complete') result = { ok: true, status: 200, session: event.session };
      else if (event.type === 'error') result = { ok: false, status: event.status, message: event.message };
      else onProgress(event);
    };
    try {
      while (!result) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
          if (result) break;
        }
        if (done) { if (!result) consume(buffer); break; }
      }
      if (!result) throw new Error('The reply was interrupted. Retry to check your saved answer and prepare the next question.');
      return result;
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The request timed out. Your response is retained. Retry to check its saved status.');
    throw error;
  } finally { clearTimeout(timer); }
}
