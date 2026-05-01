'use client';

import { useState } from 'react';

interface BioPreviewProps {
  initialBio: string | null;
  onPublished: () => void;
}

export default function BioPreview({ initialBio, onPublished }: BioPreviewProps) {
  const [bio, setBio] = useState(initialBio || '');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [edited, setEdited] = useState(false);

  async function handleSave() {
    if (!bio.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/designer/bio/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folioBio: bio }),
      });
      setEdited(false);
    } catch (err) {
      console.error('Failed to save bio:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    // Save first if edited
    if (edited) {
      await handleSave();
    }

    setPublishing(true);
    try {
      const res = await fetch('/api/designer/bio/publish', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to publish');
      }
      onPublished();
    } catch (err) {
      console.error('Failed to publish bio:', err);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="bio-preview">
      <div className="bio-preview-header">
        <h3 className="bio-preview-title">Your Generated Bio</h3>
        <p className="bio-preview-subtitle">
          Edit the text below to make it yours, then publish to your About page.
        </p>
      </div>

      <textarea
        value={bio}
        onChange={(e) => {
          setBio(e.target.value);
          setEdited(true);
        }}
        className="bio-preview-editor"
        rows={12}
      />

      <div className="bio-preview-actions">
        {edited && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="ridge-btn pill-btn bio-preview-btn"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
        )}
        <button
          onClick={handlePublish}
          disabled={publishing || !bio.trim()}
          className="accent-btn pill-btn bio-preview-btn"
        >
          {publishing ? 'Publishing...' : 'Publish to About'}
        </button>
      </div>

      <style jsx>{`
        .bio-preview {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface-canvas);
          padding: 32px;
        }
        .bio-preview-header {
          margin-bottom: 20px;
        }
        .bio-preview-title {
          font-family: var(--font-headline);
          font-size: 20px;
          font-weight: 500;
          color: var(--text-primary);
          margin: 0 0 6px;
        }
        .bio-preview-subtitle {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0;
        }
        .bio-preview-editor {
          width: 100%;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface-ground);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 15px;
          line-height: 1.7;
          resize: vertical;
          outline: none;
          margin-bottom: 16px;
        }
        .bio-preview-editor:focus {
          border-color: var(--accent);
        }
        .bio-preview-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .bio-preview-btn {
          padding: 10px 24px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
