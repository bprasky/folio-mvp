'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface EditableParagraphProps {
  text: string;
  isEdited: boolean;
  isEditing: boolean;
  placeholder?: string;
  className?: string;
  /** Element to render when not editing. Defaults to 'p'. */
  as?: 'p' | 'h2' | 'h3' | 'span' | 'blockquote';
  onStartEdit: () => void;
  onSave: (newText: string) => Promise<void>;
  onCancel: () => void;
  onRevert?: () => Promise<void>;
}

export default function EditableParagraph({
  text,
  isEdited,
  isEditing,
  placeholder,
  className = '',
  as: Tag = 'p',
  onStartEdit,
  onSave,
  onCancel,
  onRevert,
}: EditableParagraphProps) {
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when text prop changes (e.g., after revert)
  useEffect(() => {
    if (!isEditing) setDraft(text);
  }, [text, isEditing]);

  // Auto-focus and auto-size textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      autoResize(textareaRef.current);
    }
  }, [isEditing]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === text) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  }, [draft, text, onSave, onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDraft(text);
      onCancel();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            autoResize(e.target);
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={saving}
          placeholder={placeholder}
          className={`w-full resize-none bg-surface-canvas border border-[var(--accent)] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] folio-body text-folio-text-primary ${className}`}
          rows={1}
        />
        <span className="absolute bottom-1 right-2 folio-meta text-folio-text-tertiary">
          {saving ? 'Saving...' : 'Cmd+Enter to save · Esc to cancel'}
        </span>
      </div>
    );
  }

  return (
    <div className="group relative">
      <Tag
        onClick={onStartEdit}
        className={`cursor-pointer rounded px-2 py-1 -mx-2 border border-transparent group-hover:border-folio-border-subtle transition-colors ${className}`}
      >
        {text || <span className="text-folio-text-tertiary italic">{placeholder || 'Click to add text...'}</span>}
      </Tag>
      {isEdited && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRevert?.();
          }}
          className="absolute -top-2 -right-1 px-1.5 py-0.5 text-[var(--type-fine)] font-medium bg-surface-ground border border-folio-border-subtle rounded-full text-folio-text-tertiary cursor-pointer hover:text-folio-text-primary hover:border-[var(--accent)] transition-colors"
          title="Click to revert to original"
        >
          Edited
        </span>
      )}
    </div>
  );
}
