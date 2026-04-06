'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface ContactImportUploaderProps {
  onImportComplete: (stats: { totalRaw: number; totalFiltered: number; matchedCount: number }) => void;
  isImporting: boolean;
  onImportStart: () => void;
}

export default function ContactImportUploader({
  onImportComplete,
  isImporting,
  onImportStart,
}: ContactImportUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.vcf') && !name.endsWith('.vcard')) {
      setError('Please upload a CSV or VCF file.');
      return;
    }

    onImportStart();

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Import failed');
        return;
      }

      onImportComplete({
        totalRaw: data.totalRaw,
        totalFiltered: data.totalFiltered,
        matchedCount: data.matchedCount,
      });
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="glass-surface rounded-xl p-6">
      <div
        className="border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer"
        style={{
          borderColor: dragOver ? 'var(--accent)' : '#E8E4DF',
          backgroundColor: dragOver ? 'rgba(184,132,92,0.05)' : 'transparent',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.vcf,.vcard"
          onChange={handleFileInput}
          className="hidden"
        />

        {isImporting ? (
          <div>
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mb-3" />
            <p className="text-sm text-folio-text-secondary">Processing contacts...</p>
          </div>
        ) : (
          <div>
            <div className="text-3xl mb-3">📎</div>
            <p className="text-sm font-medium text-folio-text-primary mb-1">
              Drop your contacts file here
            </p>
            <p className="text-xs text-folio-text-tertiary">
              CSV or VCF/vCard format
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 mt-3">{error}</p>
      )}

      <p className="text-xs text-folio-text-tertiary mt-4">
        Folio only reads your contacts to match them with vendors. We never send emails to your contacts without your explicit action.
      </p>
    </div>
  );
}
