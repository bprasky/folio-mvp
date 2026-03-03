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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Source info */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '10px',
        background: '#FAF7F4',
        border: '1px solid #F0EBE4',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="6.5" stroke="#A89880" strokeWidth="1" />
          <path d="M8 7V11" stroke="#A89880" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="8" cy="5.5" r="0.5" fill="#A89880" />
        </svg>
        <span style={{ fontSize: '12px', color: '#8B7B68', lineHeight: 1.4 }}>
          Generated from your Folio profile and editorial content
        </span>
      </div>

      {/* Bio toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#2C2420' }}>
            Designer Bio Slide
          </div>
          <div style={{ fontSize: '12px', color: '#A89880', marginTop: '2px' }}>
            Include a designer intro in the carousel
          </div>
        </div>
        <button
          onClick={() => setBioEnabled(!bioEnabled)}
          style={{
            position: 'relative',
            width: '44px',
            height: '24px',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.2s',
            background: bioEnabled ? '#2C2420' : '#E8E0D8',
            padding: 0,
          }}
        >
          <span style={{
            position: 'absolute',
            top: '2px',
            left: bioEnabled ? '22px' : '2px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {bioEnabled && (
        <>
          {/* Bio options */}
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '12px', fontWeight: 500 }}>
              Select a Bio Blurb
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
                <p style={{ marginTop: '12px', fontSize: '13px', color: '#8B7B68' }}>Generating bio options...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bioOptions.map((bio, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedBio(bio)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: selectedBio === bio ? '1.5px solid #C4B5A0' : '1px solid #E8E0D8',
                      background: selectedBio === bio ? '#FAF7F4' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left' as const,
                      fontSize: '14px',
                      lineHeight: 1.6,
                      color: selectedBio === bio ? '#2C2420' : '#8B7B68',
                    }}
                  >
                    {bio}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom bio */}
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '8px', fontWeight: 500 }}>
              Or Write Your Own
            </div>
            <textarea
              value={customBio}
              onChange={(e) => setCustomBio(e.target.value)}
              placeholder={`Write a bio blurb for ${designerName}...`}
              rows={3}
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
                lineHeight: 1.6,
              }}
            />
            <button
              onClick={handleCustomApply}
              disabled={!customBio.trim()}
              style={{
                marginTop: '8px',
                borderRadius: '10px',
                background: '#2C2420',
                color: '#FFFFFF',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                opacity: customBio.trim() ? 1 : 0.4,
              }}
            >
              Apply
            </button>
          </div>

          {/* Regenerate */}
          <div style={{ borderTop: '1px solid #E8E0D8', paddingTop: '16px' }}>
            {showFeedback ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <textarea
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="e.g. 'More about their material sensibility' or 'Focus on the warmth of their style'"
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
                Regenerate with Direction
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
