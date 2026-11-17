'use client';

import { useCallback, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import styles from '@/components/ui/WorkflowForms.module.css';
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

  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }} placement="right" backdropClassName="bg-black/40">
    <DialogContent placement="right" className={styles.sheet}>
      <div className={styles.sheetHeader}>
        <div><p className={styles.eyebrow}>The details are already in your work</p><DialogTitle className={styles.sheetTitle}>Import a document</DialogTitle><DialogDescription className={`${styles.help} mt-3`}>Drop a presentation, a PDF, or a spec sheet. We read the file and pull the products out for you.</DialogDescription></div>
        <button type="button" onClick={onClose} className={styles.close} aria-label="Close document import"><X size={18} /></button>
      </div>
      <div className={styles.sheetBody}>
        <label onDragEnter={event => { event.preventDefault(); setIsDragOver(true); }} onDragOver={event => event.preventDefault()} onDragLeave={event => { event.preventDefault(); setIsDragOver(false); }} onDrop={handleDrop} className={`${styles.uploadChooser} ${isDragOver ? 'ring-2 ring-folio-gold' : ''}`}>
          <input type="file" accept={ACCEPT} aria-label="Choose a presentation or finish schedule" className="sr-only" onChange={event => { handleFile(event.target.files?.[0]); event.target.value = ''; }} />
          <FileText size={32} strokeWidth={1.25} aria-hidden />
          <span className={styles.secondary}>{isDragOver ? 'Drop to import' : 'Choose a document'}</span>
          <span className={styles.help}>Or drag a file here · PDF, PPTX, XLSX or CSV</span>
        </label>
      </div>
    </DialogContent>
  </Dialog>;
}
