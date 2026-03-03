'use client';

import { useState } from 'react';

interface Props {
  caption: string;
  setCaption: (v: string) => void;
  loading: boolean;
  onRegenerate: () => void;
  projectTitle: string;
  designerName: string;
}

export function CaptionTab({
  caption,
  setCaption,
  loading,
  onRegenerate,
  projectTitle,
  designerName,
}: Props) {
  const [copied, setCopied] = useState(false);

  const ctaText = 'The full editorial \u2014 and every product specification \u2014 lives on Folio.';
  const fullCaption = caption ? `${caption}\n\n${ctaText}` : '';

  const handleCopy = async () => {
    if (!fullCaption) return;
    try {
      await navigator.clipboard.writeText(fullCaption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = fullCaption;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-[13px] font-medium text-[#2C2420]">
          Instagram Caption
        </label>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E8E0D8] border-t-[#2C2420]" />
            <p className="mt-3 text-[13px] text-[#8B7B68]">Generating caption...</p>
          </div>
        ) : (
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={6}
            placeholder="Caption will be generated after selecting a headline..."
            className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-[14px] leading-relaxed text-[#2C2420] placeholder:text-[#A89880] focus:border-[#C4B5A0] focus:outline-none"
          />
        )}
      </div>

      {/* CTA preview */}
      {caption && (
        <div className="rounded-lg bg-[#F0EBE4] p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#8B7B68]">
            Auto-appended CTA
          </p>
          <p className="font-serif text-[13px] italic text-[#2C2420]">{ctaText}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          disabled={!fullCaption}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-medium transition-all duration-200 ${
            copied
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-[#2C2420] text-white disabled:opacity-40'
          }`}
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M11.667 3.5L5.25 9.917L2.333 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect
                  x="5.25"
                  y="5.25"
                  width="7"
                  height="7"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <path
                  d="M3.5 8.75H2.917C2.27 8.75 1.75 8.23 1.75 7.583V2.917C1.75 2.27 2.27 1.75 2.917 1.75H7.583C8.23 1.75 8.75 2.27 8.75 2.917V3.5"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              </svg>
              Copy Caption
            </>
          )}
        </button>

        <button
          onClick={onRegenerate}
          disabled={loading}
          className="rounded-lg border border-[#E8E0D8] px-4 py-2.5 text-[13px] font-medium text-[#8B7B68] transition-colors hover:border-[#C4B5A0] hover:text-[#2C2420] disabled:opacity-50"
        >
          Regenerate
        </button>
      </div>

      {/* Preview */}
      {fullCaption && (
        <div className="rounded-lg border border-[#E8E0D8] p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#8B7B68]">
            Full Caption Preview
          </p>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#2C2420]">
            {fullCaption}
          </p>
        </div>
      )}
    </div>
  );
}
