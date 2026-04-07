'use client';

import { useState, useCallback } from 'react';

interface VisitNotesFormProps {
  visitId: string;
  initialNotes: string;
}

export default function VisitNotesForm({ visitId, initialNotes }: VisitNotesFormProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/visits/${visitId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('[VisitNotesForm] Error:', err);
    } finally {
      setSaving(false);
    }
  }, [visitId, notes]);

  return (
    <div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes about this connection..."
        className="w-full min-h-[80px] p-3 text-sm border border-folio-border-subtle rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-stone-400"
      />
      <div className="flex items-center justify-between mt-2">
        <button
          onClick={handleSave}
          disabled={saving || notes === initialNotes}
          className="text-xs bg-stone-900 text-white py-1.5 px-4 rounded hover:bg-stone-800 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save notes'}
        </button>
        {saved && (
          <span className="text-xs text-green-600">Saved</span>
        )}
      </div>
    </div>
  );
}
