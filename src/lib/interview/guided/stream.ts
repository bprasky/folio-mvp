import { getGuidedSession, runGuidedCommand } from './service';
import { generateGuidedReaction } from './reaction';
import type { GuidedCommand, GuidedProgressEvent } from './types';

/** Called only after the route has authenticated, authorized and parsed the command. */
export function streamGuidedCommand(projectId: string, actorId: string, command: GuidedCommand,
  failure: (error: unknown) => Response, completed: () => void): Response {
  const abortReaction = new AbortController();
  const started = Date.now();
  let savedAfterMs: number | null = null;
  let reactionAfterMs: number | null = null;
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: GuidedProgressEvent) => { if (!closed) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); };
      let observation: { turnId: string; text: string } | null = null;
      let deciding = true;
      try {
        const session = await runGuidedCommand(projectId, actorId, command, {
          onSaved(saved) {
            savedAfterMs = Date.now() - started;
            emit({ type: 'saved', session: saved });
            const turn = saved.turns.find(value => value.requestId === command.requestId && !value.supersededBy);
            // Replays never enter onSaved. Controls, confirmations, corrections
            // and very short answers need no decorative second model call.
            if (closed || saved.status !== 'deciding' || command.action !== 'answer' || turn?.kind !== 'answer'
              || turn.text.trim().split(/\s+/).length < 6) return;
            void generateGuidedReaction(projectId, turn, abortReaction.signal).then(async text => {
              if (!text || !deciding || closed) return;
              const current = await getGuidedSession(projectId, actorId);
              if (!deciding || closed || current?.id !== saved.id || current.version !== saved.version
                || current.pendingDecisionTurnId !== turn.id || current.status !== 'deciding') return;
              observation = { turnId: turn.id, text };
              reactionAfterMs = Date.now() - started;
              emit({ type: 'reaction', sessionId: saved.id, version: saved.version, turnId: turn.id, text });
            }).catch(() => { /* A failed observation/read never blocks the question. */ });
          },
          observation: () => observation,
        });
        deciding = false;
        abortReaction.abort();
        completed();
        console.info('[guided-interview] reply timing', { savedAfterMs, reactionAfterMs,
          completedAfterMs: Date.now() - started, status: session.status });
        emit({ type: 'complete', session });
      } catch (error) {
        const response = failure(error);
        const data = await response.json();
        emit({ type: 'error', status: response.status, message: data.message, code: data.code });
      } finally {
        deciding = false;
        abortReaction.abort();
        if (!closed) { closed = true; controller.close(); }
      }
    },
    cancel() { closed = true; abortReaction.abort(); },
  });
  return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
}
