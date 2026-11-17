'use client';

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Check } from 'lucide-react';
import { workflowRequest } from '@/lib/client/workflowRequest';
import { cleanRoomName, roomNameKey, roomNameOptions, STANDARD_ROOM_NAMES, suggestRoomNames } from '@/lib/rooms/roomNames';
import forms from '@/components/ui/WorkflowForms.module.css';

type SavedNames = { names: string[]; ready: boolean; error: string; save: (name: string, remove?: boolean) => Promise<void> };
const SavedRoomNames = createContext<SavedNames>({ names: [], ready: false, error: '', save: async () => {} });

export function RoomNameProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const { data: session } = useSession();
  const userId = enabled ? session?.user?.id : undefined;
  return <AccountRoomNames key={userId || 'anonymous'} userId={userId}>{children}</AccountRoomNames>;
}

function AccountRoomNames({ children, userId }: { children: ReactNode; userId?: string }) {
  const [names, setNames] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    fetch('/api/me/room-names', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Your saved room names could not be loaded.');
      const data = await response.json();
      if (!Array.isArray(data.names) || data.names.some((name: unknown) => typeof name !== 'string')) throw new Error('Your saved room names could not be loaded.');
      if (!controller.signal.aborted) { setNames(data.names); setReady(true); }
    }).catch(() => { if (!controller.signal.aborted) setError('Saved room names are unavailable. You can still sort photos.'); });
    return () => controller.abort();
  }, [userId]);
  async function save(name: string, remove = false) {
    if (!userId || !ready) throw new Error('Your saved room names are unavailable. Try again after refreshing.');
    const response = await workflowRequest('/api/me/room-names', {
      method: remove ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save this room name. Try again.');
    setNames(current => remove ? current.filter(item => roomNameKey(item) !== roomNameKey(name)) :
      [...current.filter(item => roomNameKey(item) !== roomNameKey(data.name)), data.name]);
    setError('');
  }
  return <SavedRoomNames.Provider value={{ names, ready, error, save }}>{children}</SavedRoomNames.Provider>;
}

/** Inline suggestions keep custom names and keyboard entry first-class. */
export default function RoomNameInput({ rooms, label, initialValue = '', actionLabel = 'Assign', disabled, autoFocus, onSubmit, onCancel }: {
  rooms: { id: string; name: string }[];
  label: string;
  initialValue?: string;
  actionLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onSubmit: (name: string, roomId?: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const saved = useContext(SavedRoomNames);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [keepSpelling, setKeepSpelling] = useState(false);
  const options = useMemo(() => roomNameOptions(rooms, saved.names), [rooms, saved.names]);
  const { exact, matches, completion, correction } = suggestRoomNames(value, options);
  const choices = correction && !keepSpelling ? [correction] : matches;
  const visible = focused && choices.length > 0;
  const isSaved = saved.names.some(name => roomNameKey(name) === roomNameKey(value));
  const isStandard = STANDARD_ROOM_NAMES.some(name => roomNameKey(name) === roomNameKey(value));
  const locked = disabled || busy || saving;

  async function submit(name: string, roomId?: string, deliberate = false) {
    if (locked || inFlight.current || !cleanRoomName(name)) return;
    if (correction && !keepSpelling && !deliberate) {
      setFocused(true); input.current?.focus();
      setError(`Choose “${correction.name}” or keep “${cleanRoomName(name)}” to continue.`);
      return;
    }
    inFlight.current = true; setBusy(true); setError('');
    try { await onSubmit(cleanRoomName(name), roomId); setFocused(false); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not assign this room. Try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  function accept(index: number) {
    const option = choices[index];
    if (option) void submit(option.name, option.roomId, true);
  }
  async function saveName() {
    if (locked || !saved.ready || !value.trim()) return;
    setSaving(true); setError(''); setNotice('');
    try { await saved.save(cleanRoomName(value), isSaved); setNotice(isSaved ? 'Removed from your saved rooms.' : 'Saved for your future projects. Only you can see it.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save this name.'); }
    finally { setSaving(false); }
  }
  return <div className="min-w-0 flex-1 space-y-2" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <label htmlFor={id} className="sr-only">{label}</label>
    <div className="flex min-w-0 items-center gap-2">
      <input ref={input} id={id} aria-label={label} autoFocus={autoFocus} value={value} disabled={locked} maxLength={120}
        placeholder="Type a room name" autoComplete="off" spellCheck
        role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible ? `${id}-suggestions` : undefined}
        aria-activedescendant={visible && active >= 0 ? `${id}-option-${active}` : undefined}
        aria-describedby={error ? `${id}-error` : undefined} aria-invalid={!!error}
        onFocus={() => setFocused(true)}
        onChange={event => { setValue(event.target.value); setFocused(true); setActive(-1); setKeepSpelling(false); setError(''); setNotice(''); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'ArrowDown' && choices.length) { event.preventDefault(); setFocused(true); setActive((active + 1) % choices.length); }
          if (event.key === 'ArrowUp' && choices.length) { event.preventDefault(); setFocused(true); setActive(active <= 0 ? choices.length - 1 : active - 1); }
          if (event.key === 'Tab' && visible && matches.length && !event.shiftKey) {
            event.preventDefault(); setValue(matches[Math.max(0, active)].name); setActive(-1);
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (visible && active >= 0) accept(active);
            else if (visible && completion) void submit(completion.name, completion.roomId);
            else void submit(exact?.name || value, exact?.roomId);
          }
          if (event.key === 'Escape') { event.preventDefault(); if (visible) { setFocused(false); setActive(-1); } else onCancel?.(); }
        }}
        className={`${forms.field} flex-1`} />
      {value.trim() && !isStandard && !matches.length && (!correction || keepSpelling) && <button type="button" disabled={locked || !saved.ready}
        onClick={() => void saveName()} aria-label={isSaved ? 'Remove from my saved rooms' : 'Save room name for my future projects'}
        title={isSaved ? 'Saved just for you. Click to remove.' : 'Save for my future projects — only visible to me'}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-folio-border-subtle text-folio-text-secondary hover:text-folio-text-primary disabled:opacity-50">
        {isSaved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>}
      <button type="button" disabled={locked || !value.trim()} onClick={() => {
        const choice = active >= 0 ? choices[active] : exact || completion;
        void submit(choice?.name || value, choice?.roomId, active >= 0);
      }}
        className={`${forms.primary} shrink-0`}>{busy ? 'Saving…' : actionLabel}</button>
    </div>
    {visible && <div>
      {correction && !keepSpelling && <p className="mb-1 folio-meta text-folio-text-secondary">Did you mean</p>}
      <div id={`${id}-suggestions`} role="listbox" aria-label="Room name suggestions" className="flex flex-wrap gap-x-3 gap-y-1">
        {choices.map((option, index) => <button type="button" role="option" key={roomNameKey(option.name)} id={`${id}-option-${index}`} aria-selected={active === index}
          disabled={locked} onMouseDown={event => event.preventDefault()} onClick={() => accept(index)}
          className={`min-h-11 max-w-full text-left folio-meta underline decoration-folio-border-subtle underline-offset-4 hover:text-folio-text-primary ${active === index ? 'text-folio-text-primary' : 'text-folio-text-secondary'}`}>
          {option.name}{option.source === 'project' ? ' · In this project' : option.source === 'saved' ? ' · Saved by you' : ''}
        </button>)}
      </div>
      {correction && !keepSpelling && <button type="button" disabled={locked} onMouseDown={event => event.preventDefault()} onClick={() => { setKeepSpelling(true); setError(''); input.current?.focus(); }}
        className="min-h-11 max-w-full break-words text-left folio-meta text-folio-text-secondary">Keep “{cleanRoomName(value)}”</button>}
    </div>}
    {(notice || (focused && saved.error)) && <p role="status" className="folio-meta text-folio-text-secondary">{notice || saved.error}</p>}
    {error && <p id={`${id}-error`} role="alert" className="folio-meta text-folio-text-primary">{error}</p>}
  </div>;
}
