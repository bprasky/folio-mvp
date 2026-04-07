'use client';

import { useState } from 'react';
import { FaTimes, FaCopy, FaDownload, FaCheck } from 'react-icons/fa';
import { Button } from '@/components/ui/button';

interface UnrealExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportData: any;
  projectTitle: string;
}

export default function UnrealExportModal({
  isOpen,
  onClose,
  exportData,
  projectTitle,
}: UnrealExportModalProps) {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(exportData, null, 2);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unreal-export-${projectTitle.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full h-full max-w-4xl max-h-[90vh] bg-surface-canvas rounded-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-folio-border-subtle">
          <div>
            <h2 className="text-2xl font-bold text-folio-text-primary">
              Unreal Export JSON
            </h2>
            <p className="text-sm text-folio-text-secondary mt-1">
              Export data for {projectTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
            aria-label="Close"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* JSON Content */}
        <div className="flex-1 overflow-auto p-6 bg-surface-ground">
          <pre className="text-xs font-mono text-folio-text-primary whitespace-pre-wrap break-words">
            {jsonString}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-folio-border-subtle bg-surface-canvas">
          <div className="text-sm text-folio-text-secondary">
            {exportData.assets?.length || 0} asset(s) included
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleCopy}
              className="flex items-center gap-2"
            >
              {copied ? (
                <>
                  <FaCheck className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <FaCopy className="w-4 h-4" />
                  Copy JSON
                </>
              )}
            </Button>
            <Button
              onClick={handleDownload}
              className="flex items-center gap-2"
            >
              <FaDownload className="w-4 h-4" />
              Download .json file
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}




