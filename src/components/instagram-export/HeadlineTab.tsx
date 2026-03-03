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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Current headline preview */}
      {selectedHeadline && (
        <div style={{
          padding: '16px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #F5F0EB, #EDE6DD)',
          border: '1px solid #E8E0D8',
        }}>
          <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '8px', fontWeight: 500 }}>
            Current Headline
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '16px', fontStyle: 'italic', color: '#2C2420', lineHeight: 1.4 }}>
            &ldquo;{selectedHeadline}&rdquo;
          </div>
        </div>
      )}

      {/* Headline options */}
      <div>
        <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '12px', fontWeight: 500 }}>
          Select a Headline
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '2px solid #E8E0D8',
              borderTopColor: '#2C2420',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ marginTop: '12px', fontSize: '13px', color: '#8B7B68' }}>Generating headlines...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {quoteOptions.map((quote, i) => (
              <button
                key={i}
                onClick={() => setSelectedHeadline(quote)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: selectedHeadline === quote ? '1.5px solid #C4B5A0' : '1px solid #E8E0D8',
                  background: selectedHeadline === quote ? '#FAF7F4' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left' as const,
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '15px',
                  fontStyle: 'italic',
                  color: selectedHeadline === quote ? '#2C2420' : '#8B7B68',
                  lineHeight: 1.5,
                }}
              >
                &ldquo;{quote}&rdquo;
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom headline */}
      <div>
        <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '8px', fontWeight: 500 }}>
          Or Write Your Own
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={customHeadline}
            onChange={(e) => setCustomHeadline(e.target.value)}
            placeholder="Enter custom headline..."
            style={{
              flex: 1,
              borderRadius: '10px',
              border: '1px solid #E8E0D8',
              background: '#FFFFFF',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#2C2420',
              outline: 'none',
            }}
          />
          <button
            onClick={handleCustomApply}
            disabled={!customHeadline.trim()}
            style={{
              borderRadius: '10px',
              background: '#2C2420',
              color: '#FFFFFF',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              opacity: customHeadline.trim() ? 1 : 0.4,
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Regenerate */}
      <div style={{ borderTop: '1px solid #E8E0D8', paddingTop: '16px' }}>
        {showFeedback ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea
              value={feedbackInput}
              onChange={(e) => setFeedbackInput(e.target.value)}
              placeholder="e.g. 'More focus on the material choices' or 'Edgier, less safe'"
              rows={2}
              style={{
                width: '100%',
                borderRadius: '10px',
                border: '1px solid #E8E0D8',
                background: '#FFFFFF',
                padding: '10px 14px',
                fontSize: '14px',
                color: '#2C2420',
                outline: 'none',
                resize: 'vertical' as const,
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleRegenerate}
                style={{
                  flex: 1,
                  borderRadius: '10px',
                  background: '#2C2420',
                  color: '#FFFFFF',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Regenerate
              </button>
              <button
                onClick={() => setShowFeedback(false)}
                style={{
                  borderRadius: '10px',
                  border: '1px solid #E8E0D8',
                  background: '#FFFFFF',
                  padding: '10px 16px',
                  fontSize: '13px',
                  color: '#8B7B68',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowFeedback(true)}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderRadius: '10px',
              border: '1px solid #E8E0D8',
              background: '#FFFFFF',
              padding: '10px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#8B7B68',
              cursor: 'pointer',
              transition: 'all 0.2s',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11.667 1.75L12.25 2.333M9.917 3.5L6.417 7V8.167H7.583L11.083 4.667L9.917 3.5ZM9.917 3.5L11.083 4.667" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.5 8.167V10.5C10.5 11.145 9.978 11.667 9.333 11.667H3.5C2.855 11.667 2.333 11.145 2.333 10.5V4.667C2.333 4.022 2.855 3.5 3.5 3.5H5.833" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Regenerate with Direction
          </button>
        )}
      </div>
    </div>
  );
}
