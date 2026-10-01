import type { LiveAdapterSnapshot, LiveQuestion } from './adapter-types';

export interface SpeechEvent {
  message_type: 'conversation'; event_type: string; conversation_id?: string; seq: number;
  inference_id?: string; timestamp?: number; turn_idx?: number;
  properties: { role: 'user' | 'pal' | 'replica'; speech?: string; interrupted?: boolean };
}
export interface PreparedSpeech {
  question: LiveQuestion; snapshot: LiveAdapterSnapshot; text: string; inferenceId?: string;
  utteranceSeq?: number; stoppedSeq?: number; interrupted?: boolean; delivered?: boolean;
}
export interface LiveTurn {
  position: number; raw: string; historyHash: string; questionId?: string; asked?: string;
  status: 'awaiting_final' | 'saving' | 'saved' | 'needs_review'; response?: string;
  eventSeq?: number; receipt: string; leaseUntil?: number; error?: string;
  snapshot?: LiveAdapterSnapshot; reviewedText?: string; saveAction?: 'answer' | 'correct';
  selectedImageId?: string | null;
}
export interface TurnState {
  turns: LiveTurn[]; speech: PreparedSpeech[]; events: SpeechEvent[];
}
export function sameSpeech(a: string, b: string) { return a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim(); }
export function spokenQuestion(snapshot: LiveAdapterSnapshot) {
  const q = snapshot.currentQuestion;
  return q ? [q.reaction, q.text].filter(Boolean).join(' ') : '';
}
export function prepareSpeech(state: TurnState, snapshot: LiveAdapterSnapshot) {
  const q = snapshot.currentQuestion;
  if (!q) return;
  state.speech.push({ question: q, snapshot: structuredClone(snapshot), text: spokenQuestion(snapshot) });
}
export function validEvent(input: unknown): input is SpeechEvent {
  if (!input || typeof input !== 'object') return false;
  const e = input as SpeechEvent;
  return e.message_type === 'conversation' && Number.isSafeInteger(e.seq) && e.seq >= 0
    && ['conversation.utterance', 'conversation.started_speaking', 'conversation.stopped_speaking'].includes(e.event_type)
    && !!e.properties && ['pal', 'replica', 'user'].includes(e.properties.role)
    && (e.event_type !== 'conversation.utterance' || typeof e.properties.speech === 'string');
}
/** Events corroborate finality and delivery; only the authenticated backend ingests answers. */
export function acceptSpeechEvent(state: TurnState, input: SpeechEvent) {
  const e = structuredClone(input);
  if (e.properties.role === 'replica') e.properties.role = 'pal';
  if (state.events.some(old => old.seq === e.seq && old.event_type === e.event_type && old.properties.role === e.properties.role)) return;
  state.events.push(e);
  state.events.sort((a, b) => a.seq - b.seq);
  for (const utterance of state.events.filter(event => event.event_type === 'conversation.utterance' && event.properties.role === 'pal')) {
    const matching = state.speech.find(s => s.utteranceSeq === utterance.seq)
      ?? state.speech.find(s => s.utteranceSeq === undefined && sameSpeech(s.text, utterance.properties.speech ?? ''));
    if (!matching) continue;
    matching.utteranceSeq = utterance.seq;
    matching.inferenceId = utterance.inference_id;
    const stopped = state.events.find(event => event.event_type === 'conversation.stopped_speaking' && event.properties.role === 'pal'
      && !!utterance.inference_id && event.inference_id === utterance.inference_id);
    matching.interrupted = utterance.properties.interrupted === true || stopped?.properties.interrupted === true;
    matching.stoppedSeq = stopped?.seq;
    matching.delivered = !!stopped && stopped.properties.interrupted === false && !matching.interrupted;
  }
}
export function finalSpeechForTurn(state: TurnState, turn: LiveTurn) {
  const used = new Set(state.turns.filter(t => t.position !== turn.position).map(t => t.eventSeq));
  // Position is stable across retries. Text is only corroboration inside that position, never a global dedupe key.
  const previous = state.turns.filter(t => t.position < turn.position).at(-1)?.eventSeq ?? -1;
  return state.events.find(e => e.event_type === 'conversation.utterance' && e.properties.role === 'user'
    && e.seq > previous && !used.has(e.seq) && sameSpeech(e.properties.speech ?? '', turn.raw));
}
export function questionForFinal(state: TurnState, event: SpeechEvent) {
  const start = state.events.filter(e => e.properties.role === 'user' && e.event_type === 'conversation.started_speaking' && e.seq < event.seq).at(-1);
  const boundary = start?.seq ?? event.seq;
  // A generated or interrupted question is never silently credited as heard.
  return state.speech.filter(s => s.delivered && (s.stoppedSeq ?? Infinity) < boundary)
    .sort((a, b) => (b.stoppedSeq ?? 0) - (a.stoppedSeq ?? 0))[0];
}

export function completionStream(id: string, content: string) {
  const created = Math.floor(Date.now() / 1000);
  const chunk = (delta: object, finish_reason: 'stop' | null) => `data: ${JSON.stringify({id, object:'chat.completion.chunk',created,model:'folio-interview',choices:[{index:0,delta,finish_reason}]})}\n\n`;
  return chunk({role:'assistant'}, null) + chunk({content}, null) + chunk({}, 'stop') + 'data: [DONE]\n\n';
}
