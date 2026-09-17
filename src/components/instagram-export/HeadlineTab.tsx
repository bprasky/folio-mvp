'use client';

import { useState } from 'react';

interface Props {
  quoteOptions: string[];
  selectedHeadline: string;
  setSelectedHeadline: (value: string) => void;
  loading: boolean;
  error?: string | null;
  onRegenerate: (feedback?: string) => void;
}

export function HeadlineTab({quoteOptions, selectedHeadline, setSelectedHeadline, loading, error, onRegenerate}: Props) {
  const [direction, setDirection] = useState('');
  const [showDirection, setShowDirection] = useState(false);
  return <div className="space-y-6">
    <div>
      <label htmlFor="instagram-headline" className="block text-sm mb-2">Opening headline</label>
      <textarea id="instagram-headline" value={selectedHeadline} onChange={(event) => setSelectedHeadline(event.target.value)} rows={3}
        placeholder="Write the opening line for this story."
        className="w-full rounded-lg border border-neutral-200 p-3 text-sm leading-relaxed" />
    </div>
    {quoteOptions.length > 0 && <div className="space-y-2">
      <h2 className="text-sm">Headline options</h2>
      {quoteOptions.map((option, index) => <button key={index} type="button" aria-pressed={selectedHeadline === option} onClick={() => setSelectedHeadline(option)}
        className="block w-full rounded-lg border border-neutral-200 p-3 text-left text-sm leading-relaxed aria-pressed:bg-neutral-100">{option}</button>)}
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading && <p role="status" className="text-sm text-neutral-500">Preparing headline options…</p>}
    {showDirection && <div>
      <label htmlFor="headline-direction" className="block text-sm mb-2">What would you like to change?</label>
      <textarea id="headline-direction" value={direction} onChange={(event) => setDirection(event.target.value)} rows={2}
        placeholder="For example, focus on the material decision."
        className="w-full rounded-lg border border-neutral-200 p-3 text-sm" />
    </div>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={loading} onClick={() => onRegenerate(direction || undefined)} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm disabled:opacity-50">
        {error ? 'Retry headlines' : 'Suggest alternatives'}
      </button>
      <button type="button" onClick={() => setShowDirection(!showDirection)} className="px-2 py-2 text-sm underline">{showDirection ? 'Hide direction' : 'Add direction'}</button>
    </div>
  </div>;
}
