'use client';

import { useState } from 'react';

type AnyAction = {
  id: string;
  label: string;
  kind: string;
  payload: Record<string, any>;
  insightId?: string;
  insightTitle?: string;
};

/**
 * Hook for managing action modal state
 */
export function useActionModal() {
  const [action, setAction] = useState<AnyAction | null>(null);
  const open = (a: AnyAction, _insight: any) => setAction(a);
  const close = () => setAction(null);
  return {
    open,
    modal: action ? <ActionModal action={action} onClose={close} /> : null
  };
}

/**
 * Action Modal - Displays action details and allows task creation
 */
export function ActionModal({ action, onClose }: { action: AnyAction; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const response = await fetch('/api/vendor/ai-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...action,
          insightId: action.insightId,
          insightTitle: action.insightTitle
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[AI ACTION] Task created:', data);
        onClose();
        // TODO: Add toast notification
      } else {
        throw new Error('Failed to create task');
      }
    } catch (error) {
      console.error('[AI ACTION] Failed to submit:', error);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl p-5 bg-white/95 backdrop-blur-xl shadow-xl border border-neutral-300 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-neutral-800">{action.label}</h4>
          <button
            onClick={onClose}
            className="text-sm text-neutral-600 hover:text-neutral-800 transition"
          >
            Close
          </button>
        </div>
        
        <div className="text-sm text-neutral-700">
          <p className="mb-2">
            We'll prepare this as a task (no changes yet). You can connect it to Events/Editorial later.
          </p>
          <pre className="text-xs bg-neutral-50 p-3 rounded-md overflow-auto border border-neutral-200">
            {JSON.stringify(action.payload, null, 2)}
          </pre>
        </div>
        
        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 border border-neutral-300 hover:bg-neutral-100 text-neutral-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-xl px-4 py-2 bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

