'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaCheck, FaTag } from 'react-icons/fa';
import { toast } from 'sonner';

interface SkeletonItem {
  id: string;
  projectId: string;
  projectImageId: string;
  roomName?: string | null;
  bbox: { x: number; y: number; w: number; h: number };
  label: string;
  confidence: number;
  status: 'UNCONFIRMED' | 'CONFIRMED' | 'DISMISSED';
}

interface Product {
  id: string;
  name: string;
  imageUrl?: string;
  vendorName?: string;
}

interface Room {
  id: string;
  name: string;
}

interface SkeletonSidePanelProps {
  open: boolean;
  onClose: () => void;
  skeleton: SkeletonItem | null;
  projectId: string;
  roomOptions: Room[];
  onConfirm?: () => void; // Callback after successful confirmation/dismiss
}

export default function SkeletonSidePanel({
  open,
  onClose,
  skeleton,
  projectId,
  roomOptions,
  onConfirm,
}: SkeletonSidePanelProps) {
  const [mode, setMode] = useState<'choose' | 'product' | 'label'>('choose');
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [labelText, setLabelText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Reset state when skeleton changes
  useEffect(() => {
    if (skeleton) {
      setMode('choose');
      setProductSearch('');
      setProductResults([]);
      setSelectedProduct(null);
      setLabelText('');
      setSelectedRoomId(skeleton.roomName || '');
    }
  }, [skeleton]);

  // Search products
  useEffect(() => {
    if (!productSearch.trim() || mode !== 'product') {
      setProductResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(productSearch)}&limit=10`);
        if (response.ok) {
          const results = await response.json();
          setProductResults(Array.isArray(results) ? results : []);
        }
      } catch (error) {
        console.error('[SkeletonSidePanel] Product search failed:', error);
        setProductResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [productSearch, mode]);

  const handleConfirmProduct = async () => {
    if (!skeleton || !selectedProduct) return;

    setLoading(true);
    try {
      const response = await fetch('/api/living/skeleton/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skeletonItemId: skeleton.id,
          productId: selectedProduct.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to confirm skeleton');
      }

      toast.success('Confirmed as product');
      onConfirm?.();
      onClose();
    } catch (error: any) {
      console.error('[SkeletonSidePanel] Confirm product failed:', error);
      toast.error(error.message || 'Failed to confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLabel = async () => {
    if (!skeleton || !labelText.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/living/skeleton/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skeletonItemId: skeleton.id,
          label: labelText.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to confirm skeleton');
      }

      toast.success('Confirmed as label');
      onConfirm?.();
      onClose();
    } catch (error: any) {
      console.error('[SkeletonSidePanel] Confirm label failed:', error);
      toast.error(error.message || 'Failed to confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!skeleton) return;

    setLoading(true);
    try {
      const response = await fetch('/api/living/skeleton/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skeletonItemId: skeleton.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to dismiss skeleton');
      }

      toast.success('Dismissed');
      onConfirm?.();
      onClose();
    } catch (error: any) {
      console.error('[SkeletonSidePanel] Dismiss failed:', error);
      toast.error(error.message || 'Failed to dismiss');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveRoom = async () => {
    if (!skeleton || !selectedRoomId) return;

    try {
      const response = await fetch('/api/living/skeleton/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skeletonItemId: skeleton.id,
          roomName: roomOptions.find(r => r.id === selectedRoomId)?.name || selectedRoomId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to move skeleton');
      }

      toast.success('Moved to room');
      onConfirm?.();
    } catch (error: any) {
      console.error('[SkeletonSidePanel] Move room failed:', error);
      toast.error(error.message || 'Failed to move');
    }
  };

  if (!open || !skeleton) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">We noticed something here</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <FaTimes className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className="text-sm text-gray-600">
          Confirm it if you'd like — or ignore it. Nothing changes unless you choose.
        </p>

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('product')}
              className="w-full px-4 py-3 text-left border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium">Confirm as Product</div>
              <div className="text-sm text-gray-500">Search and select an existing product</div>
            </button>

            <button
              onClick={() => setMode('label')}
              className="w-full px-4 py-3 text-left border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium">Confirm as Label</div>
              <div className="text-sm text-gray-500">Enter a custom label name</div>
            </button>

            {/* Optional: Move to room */}
            {roomOptions.length > 0 && (
              <div className="border-t pt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Move to room
                </label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">Keep current room</option>
                  {roomOptions.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
                {selectedRoomId && selectedRoomId !== skeleton.roomName && (
                  <button
                    onClick={handleMoveRoom}
                    className="mt-2 w-full px-3 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                  >
                    Move
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'product' && (
          <div className="space-y-3">
            <div>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full px-3 py-2 border rounded-md"
                autoFocus
              />
            </div>

            {productResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {productResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`w-full p-3 text-left border rounded-lg transition-colors ${
                      selectedProduct?.id === product.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">{product.name}</div>
                    {product.vendorName && (
                      <div className="text-sm text-gray-500">{product.vendorName}</div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setMode('choose')}
                className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleConfirmProduct}
                disabled={!selectedProduct || loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {mode === 'label' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What is this?
              </label>
              <input
                type="text"
                value={labelText}
                onChange={(e) => setLabelText(e.target.value)}
                placeholder="e.g., Sofa, Coffee Table, Lamp"
                className="w-full px-3 py-2 border rounded-md"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setMode('choose')}
                className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleConfirmLabel}
                disabled={!labelText.trim() || loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <button
          onClick={handleDismiss}
          disabled={loading}
          className="w-full px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Dismiss (don't ask again)
        </button>
      </div>
    </div>
  );
}








