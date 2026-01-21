'use client';

/**
 * PDF Spec Import Modal
 * Uses text extraction to pull structured specification data from PDFs
 * Integrates with the PDF extraction pipeline for brand, price, dimensions, etc.
 */

import { useState, useCallback, useRef } from 'react';
import { GlassModal, GlassModalHeader, GlassModalBody } from '@/components/ui/glass-modal';
import { Button } from '@/components/ui/button';
import { FaCloudUploadAlt, FaCheck, FaSpinner, FaTimes, FaExclamationTriangle, FaFileAlt, FaMagic, FaSearch } from 'react-icons/fa';
import type { ExtractionResult, ExtractedItem } from '@/lib/pdf';

type ImportStep = 'upload' | 'extracting' | 'review' | 'importing';

interface Room {
  id: string;
  name: string;
  type?: string | null;
}

interface PdfSpecImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  rooms: Room[];
  initialFile?: File;
  onComplete?: (result: { selectionsCreated: number; skeletonsCreated: number }) => void;
}

export function PdfSpecImportModal({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  rooms,
  initialFile,
  onComplete,
}: PdfSpecImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [progress, setProgress] = useState({ current: 0, message: '' });
  const [error, setError] = useState<string | null>(null);

  // Extraction results
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [items, setItems] = useState<ExtractionResult['items']>({ high: [], medium: [], low: [] });
  const [stats, setStats] = useState<ExtractionResult['stats'] | null>(null);

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || '');
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setProgress({ current: 0, message: '' });
    setError(null);
    setExtractionId(null);
    setItems({ high: [], medium: [], low: [] });
    setStats(null);
    setSelected(new Set());
    setLoadingItems(new Set());
    setIsProcessing(false);
  }, []);

  const handleClose = useCallback(() => {
    if (isProcessing) {
      const confirmed = window.confirm('Processing is in progress. Are you sure you want to cancel?');
      if (!confirmed) return;
    }
    resetState();
    onOpenChange(false);
  }, [isProcessing, resetState, onOpenChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setFile(selectedFile);
      startExtraction(selectedFile);
    } else {
      setError('Please select a PDF file');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.pdf')) {
      setFile(droppedFile);
      startExtraction(droppedFile);
    } else {
      setError('Please drop a PDF file');
    }
  }, []);

  const startExtraction = async (pdfFile: File) => {
    setIsProcessing(true);
    setError(null);
    setStep('extracting');
    setProgress({ current: 10, message: 'Uploading PDF...' });

    try {
      const formData = new FormData();
      formData.append('file', pdfFile);

      setProgress({ current: 30, message: 'Extracting text and specifications...' });

      const res = await fetch(`/api/projects/${projectId}/extract-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Extraction failed (${res.status})`);
      }

      setProgress({ current: 80, message: 'Processing results...' });

      const result: ExtractionResult & { extractionId: string } = await res.json();

      setExtractionId(result.extractionId);
      setItems(result.items);
      setStats(result.stats);

      // Pre-select high and medium confidence items
      const initialSelected = new Set<string>();
      result.items.high.forEach(i => initialSelected.add(i.id));
      result.items.medium.forEach(i => initialSelected.add(i.id));
      setSelected(initialSelected);

      setProgress({ current: 100, message: 'Extraction complete!' });
      setStep('review');

    } catch (err: any) {
      console.error('PDF extraction error:', err);
      setError(err.message || 'Failed to extract specifications from PDF');
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleItem = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const completeWithAI = useCallback(async (item: ExtractedItem) => {
    if (!extractionId) return;

    setLoadingItems(prev => new Set(prev).add(item.id));
    setError(null);

    try {
      const res = await fetch(`/api/extractions/${extractionId}/complete-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });

      if (res.ok) {
        const { item: updated } = await res.json();
        setItems(prev => updateItemInResult(prev, updated));
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to complete item');
      }
    } catch (err) {
      console.error('Failed to complete item:', err);
      setError('Failed to complete item with AI');
    } finally {
      setLoadingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [extractionId]);

  const handleImport = async () => {
    if (!extractionId || !selectedRoomId || selected.size === 0) {
      setError('Please select items and a room');
      return;
    }

    setStep('importing');
    setIsProcessing(true);
    setProgress({ current: 50, message: 'Creating items...' });

    try {
      const res = await fetch(`/api/extractions/${extractionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedItems: Array.from(selected),
          roomId: selectedRoomId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to import items');
      }

      const result = await res.json();
      setProgress({ current: 100, message: 'Import complete!' });

      onComplete?.({
        selectionsCreated: result.created?.selections?.length || 0,
        skeletonsCreated: result.created?.skeletons?.length || 0,
      });

      setTimeout(() => {
        handleClose();
      }, 1500);

    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to import items');
      setStep('review');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalItems = items.high.length + items.medium.length + items.low.length;

  return (
    <GlassModal open={open} onOpenChange={handleClose} size="xl">
      <GlassModalHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif text-stone-900">Import PDF Specifications</h2>
            <p className="text-sm text-stone-500 mt-1">{projectTitle}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>
      </GlassModalHeader>

      <GlassModalBody>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <FaExclamationTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 text-sm">{error}</p>
              <button onClick={() => setError(null)} className="text-red-600 text-sm underline mt-1">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Upload step */}
        {step === 'upload' && (
          <div className="space-y-6">
            <p className="text-stone-600">
              Upload a PDF presentation to extract product specifications. Our AI will identify
              brands, prices, dimensions, and materials from the text.
            </p>

            <div
              className="border-2 border-dashed border-stone-300 rounded-xl p-12 text-center cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <FaFileAlt className="w-16 h-16 text-stone-400 mx-auto mb-4" />
              <p className="text-lg text-stone-700 mb-2">Drop your PDF here</p>
              <p className="text-sm text-stone-500">or click to browse • PDF up to 50MB</p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">What we extract:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Brand names (60+ known vendors)</li>
                <li>• Product names and descriptions</li>
                <li>• Prices ($1,485, $6,120 ea., etc.)</li>
                <li>• Dimensions (92"W × 19"D × 26"H)</li>
                <li>• Materials and finishes</li>
                <li>• SKUs and product URLs</li>
              </ul>
            </div>
          </div>
        )}

        {/* Extracting step */}
        {step === 'extracting' && (
          <div className="space-y-6 py-8 text-center">
            <div className="w-20 h-20 mx-auto relative">
              <div className="absolute inset-0 rounded-full border-4 border-stone-200" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-stone-900 mb-2">Extracting specifications...</h3>
              <p className="text-stone-500">{progress.message}</p>
            </div>
            <div className="max-w-xs mx-auto">
              <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${progress.current}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Review step */}
        {step === 'review' && (
          <div className="space-y-6">
            {/* Stats summary */}
            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
              <div>
                <p className="text-stone-900 font-medium">
                  Found {stats?.specificationsFound || 0} specifications, {stats?.inspirationImages || 0} inspiration images
                </p>
                <p className="text-sm text-stone-500">
                  {selected.size} of {totalItems} selected
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const allIds = [...items.high, ...items.medium, ...items.low].map(i => i.id);
                    setSelected(new Set(allIds));
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Select none
                </button>
              </div>
            </div>

            {/* Room selector */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Import to room</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>
                    {room.name} {room.type ? `(${room.type})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Items list */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {/* High confidence */}
              {items.high.length > 0 && (
                <ItemSection
                  title="Ready to Import"
                  subtitle="Complete specifications"
                  items={items.high}
                  selected={selected}
                  loadingItems={loadingItems}
                  onToggle={toggleItem}
                  onCompleteWithAI={completeWithAI}
                />
              )}

              {/* Medium confidence */}
              {items.medium.length > 0 && (
                <ItemSection
                  title="Needs Review"
                  subtitle="Partial data - can complete with AI"
                  items={items.medium}
                  selected={selected}
                  loadingItems={loadingItems}
                  onToggle={toggleItem}
                  onCompleteWithAI={completeWithAI}
                />
              )}

              {/* Low confidence */}
              {items.low.length > 0 && (
                <ItemSection
                  title="Inspiration Images"
                  subtitle="Save as search placeholders"
                  items={items.low}
                  selected={selected}
                  loadingItems={loadingItems}
                  onToggle={toggleItem}
                  onCompleteWithAI={completeWithAI}
                  isInspiration
                />
              )}

              {totalItems === 0 && (
                <div className="text-center py-8">
                  <FaFileAlt className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500">No specifications found in this PDF.</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-stone-200">
              <Button variant="ridge" onClick={() => setStep('upload')}>
                Upload Different File
              </Button>
              <Button
                variant="accent"
                onClick={handleImport}
                disabled={selected.size === 0 || !selectedRoomId}
              >
                Import {selected.size} Items
              </Button>
            </div>
          </div>
        )}

        {/* Importing step */}
        {step === 'importing' && (
          <div className="space-y-6 py-8 text-center">
            <FaSpinner className="w-12 h-12 text-[var(--accent)] mx-auto animate-spin" />
            <div>
              <h3 className="text-lg font-medium text-stone-900 mb-2">Creating items...</h3>
              <p className="text-stone-500">{progress.message}</p>
            </div>
          </div>
        )}
      </GlassModalBody>
    </GlassModal>
  );
}

// Item Section component
function ItemSection({
  title,
  subtitle,
  items,
  selected,
  loadingItems,
  onToggle,
  onCompleteWithAI,
  isInspiration = false,
}: {
  title: string;
  subtitle: string;
  items: ExtractedItem[];
  selected: Set<string>;
  loadingItems: Set<string>;
  onToggle: (id: string) => void;
  onCompleteWithAI: (item: ExtractedItem) => void;
  isInspiration?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 bg-stone-50 flex items-center justify-between hover:bg-stone-100"
      >
        <div className="text-left">
          <h4 className="font-medium text-stone-900">{title}</h4>
          <p className="text-sm text-stone-500">{subtitle} • {items.filter(i => selected.has(i.id)).length}/{items.length} selected</p>
        </div>
        <svg className={`w-5 h-5 text-stone-500 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="p-3 space-y-2">
          {items.map(item => (
            <ExtractedItemRow
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              loading={loadingItems.has(item.id)}
              onToggle={() => onToggle(item.id)}
              onCompleteWithAI={() => onCompleteWithAI(item)}
              isInspiration={isInspiration}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Individual item row
function ExtractedItemRow({
  item,
  selected,
  loading,
  onToggle,
  onCompleteWithAI,
  isInspiration,
}: {
  item: ExtractedItem;
  selected: boolean;
  loading: boolean;
  onToggle: () => void;
  onCompleteWithAI: () => void;
  isInspiration: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
        selected ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-stone-200 hover:border-stone-300'
      } ${loading ? 'opacity-60' : ''}`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
          selected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-stone-300'
        }`}>
          {selected && <FaCheck className="w-3 h-3 text-white" />}
        </div>

        {/* Image thumbnail */}
        {item.imageData && (
          <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-stone-100">
            <img
              src={`data:image/png;base64,${item.imageData}`}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              {isInspiration ? (
                <>
                  <p className="font-medium text-stone-900 text-sm">Inspiration Image</p>
                  <p className="text-xs text-stone-600 line-clamp-2">{item.searchQuery || item.description}</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-stone-900 text-sm">{item.productName || 'Unknown Product'}</p>
                  {item.brand && <p className="text-xs text-stone-600">{item.brand}</p>}
                </>
              )}
            </div>
            {item.price && (
              <span className="text-sm font-medium text-stone-900">
                ${(item.price / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>

          {/* Field badges */}
          {!isInspiration && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.dimensions && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Dimensions</span>}
              {item.material && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Material</span>}
              {item.sku && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">SKU</span>}
              {item.missingFields.slice(0, 3).map(f => (
                <span key={f} className="text-xs px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{f}</span>
              ))}
            </div>
          )}

          {/* AI complete button */}
          {!isInspiration && item.missingFields.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onCompleteWithAI(); }}
              disabled={loading}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {loading ? (
                <><FaSpinner className="w-3 h-3 animate-spin" /> Searching...</>
              ) : (
                <><FaMagic className="w-3 h-3" /> Complete with AI</>
              )}
            </button>
          )}

          {isInspiration && (
            <p className="mt-1 text-xs text-stone-500 flex items-center gap-1">
              <FaSearch className="w-3 h-3" /> Will save as search placeholder
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to update item in result structure
function updateItemInResult(
  result: ExtractionResult['items'],
  updatedItem: ExtractedItem
): ExtractionResult['items'] {
  const inHigh = result.high.some(i => i.id === updatedItem.id);
  const inMedium = result.medium.some(i => i.id === updatedItem.id);
  const inLow = result.low.some(i => i.id === updatedItem.id);

  let newResult = {
    high: inHigh ? result.high.filter(i => i.id !== updatedItem.id) : result.high,
    medium: inMedium ? result.medium.filter(i => i.id !== updatedItem.id) : result.medium,
    low: inLow ? result.low.filter(i => i.id !== updatedItem.id) : result.low,
  };

  switch (updatedItem.confidence) {
    case 'high':
      newResult.high = [...newResult.high, updatedItem];
      break;
    case 'medium':
      newResult.medium = [...newResult.medium, updatedItem];
      break;
    case 'low':
      newResult.low = [...newResult.low, updatedItem];
      break;
  }

  return newResult;
}
