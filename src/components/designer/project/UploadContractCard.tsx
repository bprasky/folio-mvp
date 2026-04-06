'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface UploadContractCardProps {
  icon: React.ReactNode;
  title: string;
  weExtract: string[];
  youGet: string[];
  accepts: string;
  onUpload: (file: File) => void;
  disabled?: boolean;
}

export function UploadContractCard({
  icon,
  title,
  weExtract,
  youGet,
  accepts,
  onUpload,
  disabled = false,
}: UploadContractCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        border rounded-lg p-6 transition-colors
        ${isDragging
          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
          : 'border-folio-border-subtle hover:border-folio-text-tertiary'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 text-folio-text-tertiary">
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-folio-text-primary mb-3">{title}</h3>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-folio-text-tertiary mb-2">We'll extract:</p>
              <ul className="space-y-1">
                {weExtract.map((item, i) => (
                  <li key={i} className="text-folio-text-secondary flex items-start gap-2">
                    <span className="text-folio-text-tertiary mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-folio-text-tertiary mb-2">You'll get:</p>
              <ul className="space-y-1">
                {youGet.map((item, i) => (
                  <li key={i} className="text-folio-text-secondary flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-folio-text-tertiary">Accepts: {accepts}</span>
            <button
              onClick={() => !disabled && inputRef.current?.click()}
              disabled={disabled}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-base)] text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accepts}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
