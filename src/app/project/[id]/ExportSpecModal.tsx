'use client';

import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

type ExportScope = 'current' | 'all';
type ExportFormat = 'xlsx' | 'pdf';

interface ExportSpecModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  currentRoomId?: string | null;
  onExport: (scope: ExportScope, format: ExportFormat, roomId?: string) => Promise<void>;
}

export default function ExportSpecModal({
  open,
  onClose,
  projectId,
  currentRoomId,
  onExport
}: ExportSpecModalProps) {
  const [scope, setScope] = useState<ExportScope>('all');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(scope, format, scope === 'current' ? currentRoomId || undefined : undefined);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
        <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-lg p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="folio-h3 text-[var(--text-primary)]">Export Spec</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[var(--bg-base)] rounded-full transition-colors"
            >
              <FaTimes className="w-4 h-4 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Scope Selection */}
          <div className="mb-6">
            <label className="block folio-ui font-medium text-[var(--text-primary)] mb-3">Scope</label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={(e) => setScope(e.target.value as ExportScope)}
                  className="w-4 h-4 text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span className="folio-ui text-[var(--text-primary)]">All rooms</span>
              </label>
              {currentRoomId && (
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="current"
                    checked={scope === 'current'}
                    onChange={(e) => setScope(e.target.value as ExportScope)}
                    className="w-4 h-4 text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <span className="folio-ui text-[var(--text-primary)]">Current room</span>
                </label>
              )}
            </div>
          </div>

          {/* Format Selection */}
          <div className="mb-6">
            <label className="block folio-ui font-medium text-[var(--text-primary)] mb-3">Format</label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="xlsx"
                  checked={format === 'xlsx'}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                  className="w-4 h-4 text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span className="folio-ui text-[var(--text-primary)]">Excel (.xlsx)</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={format === 'pdf'}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                  className="w-4 h-4 text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span className="folio-ui text-[var(--text-primary)]">PDF (.pdf)</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 folio-ui font-medium text-[var(--text-primary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-base)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 folio-ui font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


