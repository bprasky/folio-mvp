'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { GlassModal, GlassModalHeader, GlassModalBody } from '@/components/ui/glass-modal';
import { Button } from '@/components/ui/button';
import { FaCloudUploadAlt, FaCheck, FaSpinner, FaTimes, FaImage, FaDoorOpen, FaTag, FaExclamationTriangle } from 'react-icons/fa';
import { createClient } from '@supabase/supabase-js';

/**
 * MIME type for a Supabase upload. Prefers the File's own type, but a File
 * dragged in from some contexts reports empty or "application/octet-stream" —
 * which the imports bucket rejects — so fall back to the (normalized) extension.
 */
function uploadContentType(file: File, ext: string): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const byExt: Record<string, string> = {
    pdf: 'application/pdf',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return byExt[ext] || 'application/pdf';
}

type ImportStep = 'upload' | 'extracting' | 'analyzing' | 'review' | 'creating';

interface DetectedRoom {
  id: string;
  type: string;
  displayName: string;
  images: DetectedImage[];
  products: DetectedProduct[];
}

interface DetectedImage {
  id: string;
  base64?: string;
  url?: string;
  roomType?: string;
  isRelevant: boolean;
  skipReason?: string;
}

interface DetectedProduct {
  id: string;
  imageId: string;
  description: string;
  category: string;
  position: { x: number; y: number };
  confidence: 'high' | 'medium' | 'low';
  suggestion?: {
    productName: string;
    vendorName: string;
    productUrl: string;
    price?: string;
  };
  selected: boolean;
  // Extracted spec data from PDF text
  extractedVendor?: string | null;
  extractedPrice?: number | null;
  extractedDimensions?: string | null;
  extractedSku?: string | null;
  extractedMaterial?: string | null;
  extractedProductUrl?: string | null;
}

interface PresentationImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  initialFiles?: File[];
  onComplete?: (result: { roomsCreated: number; productsTagged: number }) => void;
}

const ROOM_TYPE_DISPLAY: Record<string, string> = {
  'living_room': 'Living Room',
  'bedroom': 'Bedroom',
  'kitchen': 'Kitchen',
  'bathroom': 'Bathroom',
  'dining_room': 'Dining Room',
  'office': 'Office',
  'entry': 'Entry',
  'outdoor': 'Outdoor',
  'hallway': 'Hallway',
  'laundry': 'Laundry',
  'closet': 'Closet',
  'other': 'Other',
};

export function PresentationImportModal({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  initialFiles,
  onComplete,
}: PresentationImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [files, setFiles] = useState<File[]>(initialFiles || []);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Results
  const [detectedRooms, setDetectedRooms] = useState<DetectedRoom[]>([]);
  const [skippedImages, setSkippedImages] = useState<DetectedImage[]>([]);
  const [stats, setStats] = useState({ totalImages: 0, analyzedImages: 0, totalProducts: 0 });

  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Start processing if we have initial files
  useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0 && step === 'upload') {
      setFiles(initialFiles);
      startProcessing(initialFiles);
    }
  }, [open, initialFiles]);

  const resetState = useCallback(() => {
    setStep('upload');
    setFiles([]);
    setProgress({ current: 0, total: 0, message: '' });
    setError(null);
    setSessionId(null);
    setDetectedRooms([]);
    setSkippedImages([]);
    setStats({ totalImages: 0, analyzedImages: 0, totalProducts: 0 });
    setIsProcessing(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
      startProcessing(selectedFiles);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      startProcessing(droppedFiles);
    }
  }, []);

  const startProcessing = async (filesToProcess: File[]) => {
    setIsProcessing(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      // Step 1: Create import session
      setStep('extracting');
      setProgress({ current: 0, total: 100, message: 'Creating import session...' });

      const sessionRes = await fetch('/api/import/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: 'PRESENTATION', projectId }),
        signal: abortControllerRef.current.signal,
      });

      if (!sessionRes.ok) {
        const errorData = await sessionRes.json().catch(() => ({}));
        const errorDetails = errorData.details || errorData.error || sessionRes.statusText;
        throw new Error(`Failed to create import session (${sessionRes.status}): ${errorDetails}`);
      }

      const { sessionId: newSessionId } = await sessionRes.json();
      setSessionId(newSessionId);

      // Step 2: Upload files directly to Supabase storage (bypasses Vercel body size limits)
      setProgress({ current: 5, total: 100, message: 'Uploading files to storage...' });

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const bucket = 'imports'; // Dedicated bucket for presentation uploads
      const uploadedPaths: string[] = [];

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        // Normalize the extension: some downloads carry trailing junk (e.g.
        // "report.pdf_"), which would otherwise upload as an unknown type.
        const rawExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
        const ext = rawExt.replace(/[^a-z0-9]/g, '') || 'pdf';
        const path = `imports/${newSessionId}/source-${i}.${ext}`;

        // Supabase's imports bucket allowlists MIME types, and a File dragged in
        // from some contexts reports an empty / octet-stream type. Send an
        // explicit contentType derived from the extension so PDFs/PPTX upload
        // as their real type instead of being rejected as octet-stream.
        const contentType = uploadContentType(file, ext);

        setProgress({
          current: 5 + (i / filesToProcess.length) * 10,
          total: 100,
          message: `Uploading ${file.name}...`
        });

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, { upsert: true, contentType });

        if (uploadError) {
          console.error('Supabase upload error:', uploadError);
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }

        uploadedPaths.push(path);
      }

      // Step 3: Call API to process the uploaded files
      setProgress({ current: 15, total: 100, message: 'Extracting images from presentation...' });

      const processRes = await fetch('/api/import/presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId,
          projectId,
          filePaths: uploadedPaths,
          fileNames: filesToProcess.map(f => f.name),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!processRes.ok) {
        const errorText = await processRes.text();
        let errorMessage: string;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.details || errorData.error || processRes.statusText;
        } catch {
          errorMessage = errorText || processRes.statusText;
        }
        throw new Error(`Failed to process presentation (${processRes.status}): ${errorMessage}`);
      }

      const { extractedImages, totalPages } = await processRes.json();
      setStats(prev => ({ ...prev, totalImages: totalPages || extractedImages?.length || 0 }));
      setProgress({ current: 30, total: 100, message: `Extracted ${extractedImages?.length || 0} images from ${totalPages || 0} pages` });

      // Step 3: Analyze images
      setStep('analyzing');
      setProgress({ current: 35, total: 100, message: 'Analyzing images with AI...' });

      const analyzeRes = await fetch(`/api/import/${newSessionId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
      });

      if (!analyzeRes.ok) {
        throw new Error('Failed to analyze images');
      }

      // Poll for completion
      let analysisComplete = false;
      while (!analysisComplete) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusRes = await fetch(`/api/import/${newSessionId}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!statusRes.ok) {
          throw new Error('Failed to get analysis status');
        }

        const status = await statusRes.json();

        if (status.status === 'READY_FOR_REVIEW' || status.status === 'COMPLETED') {
          analysisComplete = true;
          setStats({
            totalImages: status.totalImages || 0,
            analyzedImages: status.processingMeta?.processedImages || 0,
            totalProducts: status.totalProducts || 0,
          });
        } else if (status.status === 'FAILED') {
          throw new Error(status.errorMessage || 'Analysis failed');
        } else {
          // Update progress
          const processed = status.processingMeta?.processedImages || 0;
          const total = status.totalImages || 1;
          const progressPercent = 35 + (processed / total) * 45;
          setProgress({
            current: Math.min(progressPercent, 80),
            total: 100,
            message: `Analyzing image ${processed} of ${total}...`,
          });
        }
      }

      // Step 4: Get pending tags and organize by room
      setProgress({ current: 85, total: 100, message: 'Organizing results...' });

      const tagsRes = await fetch(`/api/import/${newSessionId}/pending-tags`, {
        signal: abortControllerRef.current.signal,
      });

      if (!tagsRes.ok) {
        throw new Error('Failed to get pending tags');
      }

      const tagsData = await tagsRes.json();
      const pendingTags = tagsData.pendingTags || [];

      // Organize by room
      const roomsMap = new Map<string, DetectedRoom>();
      const skipped: DetectedImage[] = [];

      for (const tag of pendingTags) {
        // Infer room type from tag or use 'other'
        const roomType = tag.roomType || 'other';
        const displayName = ROOM_TYPE_DISPLAY[roomType] || 'Other';

        if (!roomsMap.has(roomType)) {
          roomsMap.set(roomType, {
            id: `room-${roomType}-${Date.now()}`,
            type: roomType,
            displayName,
            images: [],
            products: [],
          });
        }

        const room = roomsMap.get(roomType)!;

        // Add image if not already added
        const imageId = tag.tempImageUrl || tag.projectImageId || `img-${tag.id}`;
        if (!room.images.find(img => img.id === imageId)) {
          room.images.push({
            id: imageId,
            url: tag.tempImageUrl,
            roomType,
            isRelevant: true,
          });
        }

        // Determine confidence based on EXTRACTED data only
        // High: has vendor AND price from text extraction (spec match)
        // Medium: has vendor OR price OR dimensions (partial spec)
        // Low: no extracted spec data (visual only - AI detected but no text specs)
        let confidence: 'high' | 'medium' | 'low' = 'low'; // Default to visual only
        const hasExtractedData = tag.extractedVendor || tag.extractedPrice || tag.extractedDimensions;
        if (tag.extractedVendor && tag.extractedPrice) {
          confidence = 'high';
        } else if (hasExtractedData) {
          confidence = 'medium';
        }
        // Note: AI's attributionConfidence/detectionConfidence no longer affects the badge
        // The badge now specifically indicates spec data quality, not AI detection confidence

        // Add product
        room.products.push({
          id: tag.id,
          imageId,
          description: tag.description,
          category: tag.category,
          position: { x: tag.x, y: tag.y },
          confidence,
          suggestion: tag.topSuggestion ? {
            productName: tag.topSuggestion.productName,
            vendorName: tag.topSuggestion.vendorName,
            productUrl: tag.topSuggestion.productUrl,
            price: tag.topSuggestion.price,
          } : undefined,
          selected: confidence === 'high',
          // Include extracted spec data
          extractedVendor: tag.extractedVendor,
          extractedPrice: tag.extractedPrice,
          extractedDimensions: tag.extractedDimensions,
          extractedSku: tag.extractedSku,
          extractedMaterial: tag.extractedMaterial,
          extractedProductUrl: tag.extractedProductUrl,
        });
      }

      setDetectedRooms(Array.from(roomsMap.values()));
      setSkippedImages(skipped);
      setProgress({ current: 100, total: 100, message: 'Analysis complete!' });

      // Move to review step
      setStep('review');

    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // User cancelled
      }
      console.error('Import processing error:', err);
      setError(err.message || 'An error occurred during processing');
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleProductSelection = useCallback((productId: string) => {
    setDetectedRooms(prev =>
      prev.map(room => ({
        ...room,
        products: room.products.map(product =>
          product.id === productId
            ? { ...product, selected: !product.selected }
            : product
        ),
      }))
    );
  }, []);

  const selectAllHighConfidence = useCallback(() => {
    setDetectedRooms(prev =>
      prev.map(room => ({
        ...room,
        products: room.products.map(product => ({
          ...product,
          selected: product.confidence === 'high' ? true : product.selected,
        })),
      }))
    );
  }, []);

  const handleCreateRoomsAndTags = async () => {
    setStep('creating');
    setProgress({ current: 0, total: 100, message: 'Creating rooms and tags...' });
    setIsProcessing(true);

    try {
      const selectedProducts = detectedRooms.flatMap(room =>
        room.products.filter(p => p.selected).map(p => ({
          ...p,
          roomType: room.type,
          roomName: room.displayName,
        }))
      );

      if (selectedProducts.length === 0) {
        throw new Error('Please select at least one product to import');
      }

      // Create rooms and tags via API
      const res = await fetch(`/api/import/${sessionId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          rooms: detectedRooms.filter(room =>
            room.products.some(p => p.selected)
          ).map(room => ({
            type: room.type,
            name: room.displayName,
          })),
          products: selectedProducts.map(p => ({
            pendingTagId: p.id,
            roomType: p.roomType,
          })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create rooms and tags');
      }

      const result = await res.json();

      setProgress({ current: 100, total: 100, message: 'Import complete!' });

      // Call completion callback
      onComplete?.({
        roomsCreated: result.roomsCreated || 0,
        productsTagged: result.productsTagged || 0,
      });

      // Close modal after short delay
      setTimeout(() => {
        handleClose();
      }, 1500);

    } catch (err: any) {
      console.error('Finalization error:', err);
      setError(err.message || 'Failed to create rooms and tags');
      setStep('review');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalSelectedProducts = detectedRooms.reduce(
    (sum, room) => sum + room.products.filter(p => p.selected).length,
    0
  );

  const highConfidenceCount = detectedRooms.reduce(
    (sum, room) => sum + room.products.filter(p => p.confidence === 'high').length,
    0
  );

  const withSpecDataCount = detectedRooms.reduce(
    (sum, room) => sum + room.products.filter(p => p.extractedVendor || p.extractedPrice).length,
    0
  );

  return (
    <GlassModal open={open} onOpenChange={handleClose} size="xl">
      <GlassModalHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif text-stone-900">Import Presentation</h2>
            <p className="text-sm text-stone-500 mt-1">
              {projectTitle}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="mt-4 flex items-center gap-2">
          {['upload', 'extracting', 'analyzing', 'review', 'creating'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-[var(--accent)] text-white'
                    : ['upload', 'extracting', 'analyzing', 'review', 'creating'].indexOf(step) > i
                    ? 'bg-emerald-500 text-white'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                {['upload', 'extracting', 'analyzing', 'review', 'creating'].indexOf(step) > i ? (
                  <FaCheck className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 4 && <div className="w-8 h-px bg-stone-300 mx-1" />}
            </div>
          ))}
        </div>
      </GlassModalHeader>

      <GlassModalBody>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <FaExclamationTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 text-sm underline mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Upload step */}
        {step === 'upload' && (
          <div className="space-y-6">
            <p className="text-stone-600">
              Upload your presentation file (PDF or PPTX). Our AI will analyze the images,
              detect products, and help you create rooms with tagged items.
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
                accept=".pdf,.pptx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <FaCloudUploadAlt className="w-16 h-16 text-stone-400 mx-auto mb-4" />
              <p className="text-lg text-stone-700 mb-2">
                Drop your presentation here
              </p>
              <p className="text-sm text-stone-500">
                or click to browse • PDF or PPTX up to 50MB
              </p>
            </div>
          </div>
        )}

        {/* Extracting/Analyzing step */}
        {(step === 'extracting' || step === 'analyzing') && (
          <div className="space-y-6 py-8 text-center">
            <div className="w-20 h-20 mx-auto relative">
              <div className="absolute inset-0 rounded-full border-4 border-stone-200" />
              <div
                className="absolute inset-0 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin"
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-stone-900 mb-2">
                {step === 'extracting' ? 'Extracting images...' : 'Analyzing with AI...'}
              </h3>
              <p className="text-stone-500">
                {progress.message}
              </p>
            </div>

            <div className="max-w-xs mx-auto">
              <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${progress.current}%` }}
                />
              </div>
              <p className="text-sm text-stone-400 mt-2">{Math.round(progress.current)}%</p>
            </div>

            {stats.totalImages > 0 && (
              <div className="flex justify-center gap-8 text-sm">
                <div>
                  <span className="text-stone-500">Images:</span>{' '}
                  <span className="font-medium">{stats.analyzedImages}/{stats.totalImages}</span>
                </div>
                <div>
                  <span className="text-stone-500">Products found:</span>{' '}
                  <span className="font-medium">{stats.totalProducts}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Review step */}
        {step === 'review' && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
              <div>
                <p className="text-stone-900 font-medium">
                  Found {stats.totalProducts} products in {detectedRooms.length} rooms
                </p>
                <p className="text-sm text-stone-500">
                  {totalSelectedProducts} selected • {withSpecDataCount > 0 ? `${withSpecDataCount} with specs` : `${highConfidenceCount} high confidence`}
                </p>
              </div>
              {highConfidenceCount > 0 && (
                <Button
                  variant="ridge"
                  size="sm"
                  onClick={selectAllHighConfidence}
                >
                  Select All High Confidence
                </Button>
              )}
            </div>

            {/* Rooms list */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {detectedRooms.map((room) => (
                <div key={room.id} className="border border-stone-200 rounded-lg overflow-hidden">
                  <div className="p-3 bg-stone-50 flex items-center gap-3">
                    <FaDoorOpen className="w-5 h-5 text-[var(--accent)]" />
                    <div className="flex-1">
                      <h4 className="font-medium text-stone-900">{room.displayName}</h4>
                      <p className="text-sm text-stone-500">
                        {room.images.length} images • {room.products.length} products
                      </p>
                    </div>
                  </div>

                  <div className="p-3 space-y-2">
                    {room.products.map((product) => (
                      <div
                        key={product.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          product.selected
                            ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                            : 'border-stone-200 hover:border-stone-300'
                        }`}
                        onClick={() => toggleProductSelection(product.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              product.selected
                                ? 'bg-[var(--accent)] border-[var(--accent)]'
                                : 'border-stone-300'
                            }`}
                          >
                            {product.selected && (
                              <FaCheck className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Product description or extracted vendor */}
                            <p className="text-stone-900 text-sm font-medium">
                              {product.extractedVendor || product.description}
                            </p>
                            {product.extractedVendor && (
                              <p className="text-stone-600 text-xs mt-0.5">{product.description}</p>
                            )}

                            {/* Extracted spec data row */}
                            {(product.extractedPrice || product.extractedDimensions || product.extractedSku) && (
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                {product.extractedPrice && (
                                  <span className="text-sm font-semibold text-emerald-700">
                                    ${(product.extractedPrice / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                                {product.extractedDimensions && (
                                  <span className="text-xs text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
                                    {product.extractedDimensions}
                                  </span>
                                )}
                                {product.extractedSku && (
                                  <span className="text-xs text-stone-500">
                                    SKU: {product.extractedSku}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Category and confidence badges */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-xs text-stone-500">{product.category}</span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  product.confidence === 'high'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : product.confidence === 'medium'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-stone-100 text-stone-500'
                                }`}
                              >
                                {product.confidence === 'high' ? 'spec match' : product.confidence === 'medium' ? 'partial spec' : 'visual only'}
                              </span>
                            </div>

                            {/* Material if extracted */}
                            {product.extractedMaterial && (
                              <p className="text-xs text-stone-500 mt-1">
                                Materials: {product.extractedMaterial}
                              </p>
                            )}

                            {/* Suggestion match (fallback if no extracted data) */}
                            {product.suggestion && !product.extractedVendor && (
                              <p className="text-xs text-stone-500 mt-1">
                                Match: {product.suggestion.productName} by {product.suggestion.vendorName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {detectedRooms.length === 0 && (
                <div className="text-center py-8">
                  <FaImage className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500">No products were detected in this presentation.</p>
                  <p className="text-sm text-stone-400 mt-1">
                    Try uploading a presentation with more interior photos.
                  </p>
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
                onClick={handleCreateRoomsAndTags}
                disabled={totalSelectedProducts === 0}
              >
                <FaTag className="w-4 h-4 mr-2" />
                Create {detectedRooms.filter(r => r.products.some(p => p.selected)).length} Rooms
                {totalSelectedProducts > 0 && ` with ${totalSelectedProducts} Tags`}
              </Button>
            </div>
          </div>
        )}

        {/* Creating step */}
        {step === 'creating' && (
          <div className="space-y-6 py-8 text-center">
            <FaSpinner className="w-12 h-12 text-[var(--accent)] mx-auto animate-spin" />
            <div>
              <h3 className="text-lg font-medium text-stone-900 mb-2">
                Creating rooms and tags...
              </h3>
              <p className="text-stone-500">
                {progress.message}
              </p>
            </div>
          </div>
        )}
      </GlassModalBody>
    </GlassModal>
  );
}
