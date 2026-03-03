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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Caption editor */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#8B7B68', fontWeight: 500 }}>
            Instagram Caption
          </div>
          {caption && (
            <div style={{ fontSize: '12px', color: '#A89880' }}>
              {caption.length} characters
            </div>
          )}
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
            <p style={{ marginTop: '12px', fontSize: '13px', color: '#8B7B68' }}>Generating caption...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : (
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={6}
            placeholder="Caption will be generated after selecting a headline..."
            style={{
              width: '100%',
              borderRadius: '10px',
              border: '1px solid #E8E0D8',
              background: '#FFFFFF',
              padding: '12px 14px',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#2C2420',
              outline: 'none',
              resize: 'vertical' as const,
              fontFamily: 'inherit',
            }}
          />
        )}
      </div>

      {/* CTA preview */}
      {caption && (
        <div style={{
          padding: '14px 16px',
          borderRadius: '10px',
          background: '#FAF7F4',
          border: '1px solid #F0EBE4',
        }}>
          <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '6px', fontWeight: 500 }}>
            Auto-appended CTA
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '13px', fontStyle: 'italic', color: '#2C2420' }}>
            {ctaText}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleCopy}
          disabled={!fullCaption}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            borderRadius: '10px',
            padding: '10px',
            fontSize: '13px',
            fontWeight: 500,
            border: copied ? '1px solid #bbf7d0' : 'none',
            cursor: fullCaption ? 'pointer' : 'default',
            transition: 'all 0.2s',
            background: copied ? '#f0fdf4' : '#2C2420',
            color: copied ? '#15803d' : '#FFFFFF',
            opacity: fullCaption ? 1 : 0.4,
          }}
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11.667 3.5L5.25 9.917L2.333 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="5.25" y="5.25" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1" />
                <path d="M3.5 8.75H2.917C2.27 8.75 1.75 8.23 1.75 7.583V2.917C1.75 2.27 2.27 1.75 2.917 1.75H7.583C8.23 1.75 8.75 2.27 8.75 2.917V3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
              Copy Caption
            </>
          )}
        </button>

        <button
          onClick={onRegenerate}
          disabled={loading}
          style={{
            borderRadius: '10px',
            border: '1px solid #E8E0D8',
            background: '#FFFFFF',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#8B7B68',
            cursor: 'pointer',
            transition: 'all 0.2s',
            opacity: loading ? 0.5 : 1,
          }}
        >
          Regenerate
        </button>
      </div>

      {/* Full preview */}
      {fullCaption && (
        <div style={{
          padding: '14px 16px',
          borderRadius: '10px',
          border: '1px solid #E8E0D8',
        }}>
          <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '8px', fontWeight: 500 }}>
            Full Caption Preview
          </div>
          <div style={{ whiteSpace: 'pre-wrap' as const, fontSize: '13px', lineHeight: 1.6, color: '#2C2420' }}>
            {fullCaption}
          </div>
        </div>
      )}
    </div>
  );
}
