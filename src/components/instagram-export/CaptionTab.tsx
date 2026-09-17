'use client';

import { useState } from 'react';

interface Props {
  caption: string;
  captionOptions?: string[];
  error?: string | null;
  setCaption: (value: string) => void;
  loading: boolean;
  onRegenerate: () => void;
  projectTitle: string;
  designerName: string;
}

export function CaptionTab({ caption, captionOptions = [], error, setCaption, loading, onRegenerate }: Props) {
  const [copyStatus, setCopyStatus] = useState('');
  return <div className="space-y-6">
    <div>
      <label htmlFor="instagram-caption" className="block text-sm mb-2">Proposed caption</label>
      <textarea id="instagram-caption" value={caption} onChange={(event) => setCaption(event.target.value)} rows={7}
        placeholder="Write your caption or request suggestions below."
        className="w-full rounded-lg border border-neutral-200 p-3 text-sm leading-relaxed" />
      <p className="mt-2 text-xs text-neutral-500">{caption.length} characters</p>
    </div>
    {captionOptions.length > 0 && <div className="space-y-2">
      <h2 className="text-sm">Caption options</h2>
      {captionOptions.map((option, index) => <button key={index} type="button" aria-pressed={caption === option}
        onClick={() => setCaption(option)} className="block w-full rounded-lg border border-neutral-200 p-3 text-left text-sm leading-relaxed aria-pressed:bg-neutral-100">
        {option}
      </button>)}
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading && <p role="status" className="text-sm text-neutral-500">Preparing caption options…</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={loading} onClick={onRegenerate} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm disabled:opacity-50">
        {error ? 'Retry captions' : 'Suggest alternatives'}
      </button>
      <button type="button" disabled={!caption} onClick={async () => {
        try { await navigator.clipboard.writeText(caption); setCopyStatus('Copied'); }
        catch { setCopyStatus('Select the caption above to copy it.'); }
      }} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm disabled:opacity-50">Copy caption</button>
    </div>
    {copyStatus && <p role="status" className="text-sm">{copyStatus}</p>}
  </div>;
}
