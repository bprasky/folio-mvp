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
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        ref={dialogRef}
        className="bg-white rounded-2xl shadow-xl border border-neutral-200 max-w-md w-full p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        {/* Header */}
        <div className="mb-4">
          <h2 
            id="dialog-title"
            className="text-lg font-semibold text-neutral-900"
          >
            {title}
          </h2>
        </div>

        {/* Description */}
        <div className="mb-6">
          <p 
            id="dialog-description"
            className="text-sm text-neutral-600 leading-relaxed"
          >
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
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

