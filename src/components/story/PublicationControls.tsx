'use client';

import { useEffect, useState } from 'react';
import type { RoomTileData } from '@/lib/story/buildRoomTiles';
import { orderedRooms } from '@/lib/story/roomSlides';
import { readPresentation, type Presentation } from '@/lib/story/presentation';
import { useStoryEdit } from './StoryEditContext';
import styles from './ImmersiveRooms.module.css';

export function PublicationControls({ rooms, value, saved, onChange }: {
  rooms: RoomTileData[]; value: Presentation; saved: Presentation; onChange: (value: Presentation) => void;
}) {
  const edit = useStoryEdit();
  const [colors, setColors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<Presentation | null>(null);
  useEffect(() => setConfirmed(null), [saved]);
  if (!edit) return null;
  const currentSaved = confirmed ?? saved;
  const dirty = JSON.stringify(currentSaved) !== JSON.stringify(value);
  const sorted = orderedRooms(rooms, value.roomOrder);

  async function findColors() {
    setLoading(true); setError(''); setMessage('');
    try {
      const res = await fetch(`/api/posting/project/${edit!.projectId}/presentation`, { signal: AbortSignal.timeout(60000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read the photo colors. Try again.');
      setColors(data.colors);
      if (!data.colors.length) setMessage('No photo colors could be read. Neutral is still available.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read photo colors.'); }
    finally { setLoading(false); }
  }

  async function save() {
    setSaving(true); setError(''); setMessage('');
    const snapshot = value;
    try {
      const res = await fetch(`/api/posting/project/${edit!.projectId}/presentation`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(snapshot.accent !== currentSaved.accent ? { accent: snapshot.accent } : {}),
          ...(JSON.stringify(snapshot.roomOrder) !== JSON.stringify(currentSaved.roomOrder) ? { roomOrder: snapshot.roomOrder } : {}),
        }), signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Your layout could not be saved. Please retry.');
      const stored = readPresentation(data.presentation);
      setConfirmed(stored); onChange(stored); setMessage('Saved for your article and Instagram exports.'); edit!.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your layout could not be saved.'); }
    finally { setSaving(false); }
  }

  function move(index: number, direction: number) {
    const ids = sorted.map(room => room.roomId);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    onChange({ ...value, roomOrder: ids }); setMessage('');
  }

  return <details className={styles.settings}>
    <summary>Publication appearance{dirty ? ' · Unsaved changes' : ''}</summary>
    <p>Choose a color from your photographs, or keep a neutral finish. The photographs keep their original colors.</p>
    <fieldset disabled={saving}>
      <legend>Color theme</legend>
      <div className={styles.swatches}>
        <button type="button" aria-pressed={value.accent === null} onClick={() => onChange({ ...value, accent: null })}>Neutral</button>
        {Array.from(new Set([...colors, ...(value.accent ? [value.accent] : [])])).map(color =>
          <button type="button" key={color} aria-label={`Use photo color ${color}`} title={color} aria-pressed={value.accent === color}
            onClick={() => onChange({ ...value, accent: color })}>
            <span style={{ background: color }} aria-hidden="true" />{color}
          </button>)}
        <button type="button" disabled={loading} onClick={findColors}>{loading ? 'Reading photos…' : 'Find colors in photos'}</button>
      </div>
      <details className={styles.order}>
        <summary>Room order</summary>
        <p>Put your favorite rooms first. Rooms without a story share photo galleries.</p>
        {edit.anyFieldOpen && <p>Finish your text edit before changing the room order.</p>}
        <ol>{sorted.map((room, index) => <li key={room.roomId}>
          <span>{room.roomLabel}</span>
          <button type="button" disabled={index === 0 || edit.anyFieldOpen} aria-label={`Move ${room.roomLabel} earlier`} onClick={() => move(index, -1)}>↑</button>
          <button type="button" disabled={index === sorted.length - 1 || edit.anyFieldOpen} aria-label={`Move ${room.roomLabel} later`} onClick={() => move(index, 1)}>↓</button>
        </li>)}</ol>
        <button type="button" disabled={edit.anyFieldOpen} onClick={() => onChange({ ...value, roomOrder: [] })}>Restore original order</button>
      </details>
      <div className={styles.saveRow}>
        <button type="button" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save appearance'}</button>
        {dirty && <button type="button" disabled={edit.anyFieldOpen} onClick={() => { onChange(currentSaved); setError(''); }}>Discard changes</button>}
      </div>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </details>;
}
