'use client';

import { useState } from 'react';

interface Props {
  bioEnabled: boolean;
  setBioEnabled: (v: boolean) => void;
  bioOptions: string[];
  selectedBio: string;
  setSelectedBio: (v: string) => void;
  loading: boolean;
  onRegenerate: (feedback?: string) => void;
  designerName: string;
}

export function DesignerTab({
  bioEnabled,
  setBioEnabled,
  bioOptions,
  selectedBio,
  setSelectedBio,
  loading,
  onRegenerate,
  designerName,
}: Props) {
  const [customBio, setCustomBio] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const handleCustomApply = () => {
    if (customBio.trim()) {
      setSelectedBio(customBio.trim());
    }
  };

  const handleRegenerate = () => {
    onRegenerate(feedbackInput || undefined);
    setShowFeedback(false);
    setFeedbackInput('');
  };

  return (
    <div className="space-y-6">
      {/* Bio toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-[13px] font-medium text-[#2C2420]">
            Designer Bio Slide
          </label>
          <p className="mt-0.5 text-[12px] text-[#A89880]">
            Include a designer intro in the carousel
          </p>
        </div>
        <button
          onClick={() => setBioEnabled(!bioEnabled)}
          className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
            bioEnabled ? 'bg-[#2C2420]' : 'bg-[#E8E0D8]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              bioEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {bioEnabled && (
        <>
          {/* Bio options */}
          <div>
            <label className="mb-3 block text-[13px] font-medium text-[#2C2420]">
              Select a Bio Blurb
            </label>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E8E0D8] border-t-[#2C2420]" />
                <p className="mt-3 text-[13px] text-[#8B7B68]">Generating bio options...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bioOptions.map((bio, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedBio(bio)}
                    className={`w-full rounded-lg border p-3 text-left text-[14px] leading-relaxed transition-all duration-200 ${
                      selectedBio === bio
                        ? 'border-[#C4B5A0] bg-[#F0EBE4] text-[#2C2420]'
                        : 'border-[#E8E0D8] text-[#8B7B68] hover:border-[#C4B5A0] hover:text-[#2C2420]'
                    }`}
                  >
                    {bio}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom bio */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-[#2C2420]">
              Or Write Your Own
            </label>
            <textarea
              value={customBio}
              onChange={(e) => setCustomBio(e.target.value)}
              placeholder={`Write a bio blurb for ${designerName}...`}
              rows={3}
              className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-[14px] text-[#2C2420] placeholder:text-[#A89880] focus:border-[#C4B5A0] focus:outline-none"
            />
            <button
              onClick={handleCustomApply}
              disabled={!customBio.trim()}
              className="mt-2 rounded-lg bg-[#2C2420] px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
            >
              Apply
            </button>
          </div>

          {/* Regenerate */}
          <div className="border-t border-[#E8E0D8] pt-4">
            {showFeedback ? (
              <div className="space-y-3">
                <textarea
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="e.g. 'More about their material sensibility' or 'Focus on the warmth of their style'"
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
                Regenerate with Direction
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
