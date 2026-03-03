'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmText: string;
  cancelText?: string;
  confirmVariant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
  open: boolean;
}

export default function ConfirmDialog({
  title,
  description,
  confirmText,
  cancelText = 'Cancel',
  confirmVariant = 'default',
  onConfirm,
  onCancel,
  open
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, onCancel]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  if (!open) return null;

  const confirmButtonClasses = confirmVariant === 'destructive' 
    ? 'bg-[rgb(74,44,59)] hover:bg-[rgb(74,44,59)]/80 focus:ring-[rgb(74,44,59)]'
    : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] focus:ring-[var(--accent)]';

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        ref={dialogRef}
        className="bg-[var(--bg-base)] rounded-2xl shadow-xl border border-[var(--ridge-outer)] max-w-md w-full p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        {/* Header */}
        <div className="mb-4">
          <h2 
            id="dialog-title"
            className="text-lg font-semibold text-[var(--text-primary)]"
          >
            {title}
          </h2>
        </div>

        {/* Description */}
        <div className="mb-6">
          <p 
            id="dialog-description"
            className="text-sm text-[var(--text-secondary)] leading-relaxed"
          >
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-base)] border border-[var(--ridge-outer)] rounded-lg hover:bg-[var(--bg-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${confirmButtonClasses}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


















