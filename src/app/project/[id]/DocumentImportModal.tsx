'use client';

import { useCallback, useRef, useState } from 'react';
import { FileText, X } from 'lucide-react';

interface DocumentImportModalProps {
  open: boolean;
  onClose: () => void;
  /** Hands the chosen file back so the caller can route it to the right pipeline. */
  onSelect: (file: File) => void;
}

const ACCEPT = '.pdf,.pptx,.ppt,.xlsx,.xls,.csv';

/**
 * One document upload for the materials step. The designer drops a deck or a
 * spec sheet; the caller routes it to the dedicated pipeline by file type (PDF
 * to the spec extractor, PowerPoint to the presentation importer). Selection
 * happens inside this modal, so no programmatic file-picker gesture is needed.
 */
export default function DocumentImportModal({
  open,
  onClose,
  onSelect,
}: DocumentImportModalProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (file) onSelect(file);
    },
    [onSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFile(e.dataTransfer.files?.[0]);
    },
    [handleFile],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 glass-backdrop" onClick={onClose} />

      <div className="relative warm-mesh rounded-2xl bg-surface-ground border border-folio-border-subtle shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="relative z-[1] p-7">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="font-headline italic text-3xl text-folio-text-primary">
            Import a document
          </h2>
          <p className="folio-body text-folio-text-secondary mt-1.5 mb-6">
            Drop a presentation, a PDF, or a spec sheet. We read the file and pull the
            products out for you.
          </p>

          <div
            onDragEnter={e => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragOver={e => e.preventDefault()}
            onDragLeave={e => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              isDragOver
                ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                : 'border-folio-border-subtle hover:border-[var(--folio-gold)] bg-surface-canvas'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={e => {
                handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <FileText
              className={`mx-auto mb-3 h-10 w-10 ${
                isDragOver ? 'text-[var(--accent)]' : 'text-folio-text-tertiary'
              }`}
            />
            <p className="folio-ui font-medium text-folio-text-primary">
              {isDragOver ? 'Drop to import' : 'Drag a file here, or click to browse'}
            </p>
            <p className={"mt-1 font-metricsMono text-[12px] tracking-tight text-folio-text-tertiary" /* folio-design-system: off-scale */}>
              PDF · PPTX · XLSX · CSV
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
