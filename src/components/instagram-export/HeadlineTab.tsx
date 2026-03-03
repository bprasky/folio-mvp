'use client';

import { useState } from 'react';

interface Props {
  quoteOptions: string[];
  selectedHeadline: string;
  setSelectedHeadline: (v: string) => void;
  loading: boolean;
  onRegenerate: (feedback?: string) => void;
}

export function HeadlineTab({
  quoteOptions,
  selectedHeadline,
  setSelectedHeadline,
  loading,
  onRegenerate,
}: Props) {
  const [customHeadline, setCustomHeadline] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const handleCustomApply = () => {
    if (customHeadline.trim()) {
      setSelectedHeadline(customHeadline.trim());
    }
  };

  const handleRegenerate = () => {
    onRegenerate(feedbackInput || undefined);
    setShowFeedback(false);
    setFeedbackInput('');
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-3 block text-[13px] font-medium text-[#2C2420]">
          Select a Headline
        </label>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E8E0D8] border-t-[#2C2420]" />
            <p className="mt-3 text-[13px] text-[#8B7B68]">Generating headlines...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {quoteOptions.map((quote, i) => (
              <button
                key={i}
                onClick={() => setSelectedHeadline(quote)}
                className={`w-full rounded-lg border p-3 text-left font-serif text-[15px] italic transition-all duration-200 ${
                  selectedHeadline === quote
                    ? 'border-[#C4B5A0] bg-[#F0EBE4] text-[#2C2420]'
                    : 'border-[#E8E0D8] text-[#8B7B68] hover:border-[#C4B5A0] hover:text-[#2C2420]'
                }`}
              >
                &ldquo;{quote}&rdquo;
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom headline */}
      <div>
        <label className="mb-2 block text-[13px] font-medium text-[#2C2420]">
          Or Write Your Own
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customHeadline}
            onChange={(e) => setCustomHeadline(e.target.value)}
            placeholder="Enter custom headline..."
            className="flex-1 rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-[14px] text-[#2C2420] placeholder:text-[#A89880] focus:border-[#C4B5A0] focus:outline-none"
          />
          <button
            onClick={handleCustomApply}
            disabled={!customHeadline.trim()}
            className="rounded-lg bg-[#2C2420] px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Regenerate */}
      <div className="border-t border-[#E8E0D8] pt-4">
        {showFeedback ? (
          <div className="space-y-3">
            <textarea
              value={feedbackInput}
              onChange={(e) => setFeedbackInput(e.target.value)}
              placeholder="e.g. 'More focus on the material choices' or 'Edgier, less safe'"
              rows={2}
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-[14px] text-[#2C2420] placeholder:text-[#A89880] focus:border-[#C4B5A0] focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleRegenerate}
                className="flex-1 rounded-lg bg-[#2C2420] py-2 text-[13px] font-medium text-white"
              >
                Regenerate
              </button>
              <button
                onClick={() => setShowFeedback(false)}
                className="rounded-lg border border-[#E8E0D8] px-4 py-2 text-[13px] text-[#8B7B68]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowFeedback(true)}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E8E0D8] py-2.5 text-[13px] font-medium text-[#8B7B68] transition-colors hover:border-[#C4B5A0] hover:text-[#2C2420] disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M11.667 1.75L12.25 2.333M9.917 3.5L6.417 7V8.167H7.583L11.083 4.667L9.917 3.5ZM9.917 3.5L11.083 4.667"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.5 8.167V10.5C10.5 11.145 9.978 11.667 9.333 11.667H3.5C2.855 11.667 2.333 11.145 2.333 10.5V4.667C2.333 4.022 2.855 3.5 3.5 3.5H5.833"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Regenerate with Direction
          </button>
        )}
      </div>
    </div>
  );
}
