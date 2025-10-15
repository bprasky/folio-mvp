'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaTimes, FaSpinner } from 'react-icons/fa';
import ProductForm from '@/components/products/ProductForm';

interface ProductFormData {
  name: string;
  sku: string;
  url: string;
  vendorName: string;
  priceCents: string;
  imageUrl: string;
  description?: string;
  brand?: string;
  currency?: string;
}

interface EditProductDrawerProps {
  open: boolean;
  onClose: () => void;
  productId?: string;
  selectionId?: string;
  projectId?: string;
  roomId?: string;
  roomType?: string;
}

export default function EditProductDrawer({ 
  open, 
  onClose, 
  productId, 
  selectionId,
  projectId,
  roomId,
  roomType
}: EditProductDrawerProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [productData, setProductData] = useState<Partial<ProductFormData>>({});
  const [error, setError] = useState('');

  // Fetch selection data when drawer opens
  useEffect(() => {
    if (open) {
      if (selectionId) {
        fetchProductData();
      } else {
        // Create mode - reset form to defaults
        setProductData({
          name: '',
          sku: '',
          url: '',
          vendorName: '',
          priceCents: '',
          imageUrl: '',
          description: '',
          brand: '',
          currency: 'USD',
          dimensions: {
            widthIn: undefined,
            depthIn: undefined,
            heightIn: undefined
          }
        });
        setError('');
        setIsLoadingData(false);
      }
    }
  }, [open, selectionId]);

  const fetchProductData = async () => {
    if (!selectionId) return;
    
    setIsLoadingData(true);
    setError('');

    try {
      // Fetch selection data from API
      const response = await fetch(`/api/selections/${selectionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch selection data');
      }
      
      const selection = await response.json();
      
      // Transform selection data to form format
      setProductData({
        name: selection.productName || '',
        sku: selection.vendorProductId || '',
        url: selection.productUrl || '',
        vendorName: selection.vendorName || '',
        priceCents: selection.unitPrice ? Math.round(Number(selection.unitPrice) * 100).toString() : '',
        imageUrl: selection.photo || '',
        description: selection.notes || '',
        brand: selection.vendorName || '',
        currency: 'USD',
        dimensions: selection.uiMeta?.dimensions || {
          widthIn: undefined,
          depthIn: undefined,
          heightIn: undefined
        },
        slotKey: selection.slotKey || ''
      });
    } catch (error: any) {
      setError(error.message || 'Failed to load selection data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSubmit = async (formData: ProductFormData) => {
    setIsLoading(true);
    setError('');

    try {
      let response;
      
      if (selectionId) {
        // Update existing selection
        response = await fetch(`/api/selections/${selectionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName: formData.name,
            vendorName: formData.vendorName,
            productUrl: formData.url,
            photo: formData.imageUrl,
            notes: formData.description,
            unitPrice: formData.priceCents ? Number(formData.priceCents) / 100 : null,
            vendorProductId: formData.sku,
            slotKey: formData.slotKey || null,
            uiMeta: {
              dimensions: formData.dimensions,
              slotKey: formData.slotKey
            }
          }),
        });
      } else {
        // Create new selection
        response = await fetch('/api/selections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName: formData.name,
            vendorName: formData.vendorName,
            productUrl: formData.url,
            photo: formData.imageUrl,
            notes: formData.description,
            unitPrice: formData.priceCents ? Number(formData.priceCents) / 100 : null,
            vendorProductId: formData.sku,
            projectId: projectId,
            roomId: roomId,
            slotKey: formData.slotKey || null,
            uiMeta: {
              dimensions: formData.dimensions,
              slotKey: formData.slotKey
            }
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update selection');
      }

      // Track edit action
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'edit_open', {
          event_category: 'designer_boards',
          event_label: 'selection_edit'
        });
      }

      // Close drawer and refresh
      onClose();
      
      // Add a small delay to ensure the API call completes
      setTimeout(() => {
        router.refresh();
      }, 100);
    } catch (error: any) {
      setError(error.message || 'Failed to update selection');
    } finally {
      setIsLoading(false);
    }
  };


  const handleClose = () => {
    setError('');
    setProductData({});
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Edit Product
            </h2>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoadingData ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3 text-gray-600">
                  <FaSpinner className="w-5 h-5 animate-spin" />
                  <span>Loading product data...</span>
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
                <button
                  onClick={fetchProductData}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <ProductForm
                mode="edit"
                initialData={productData}
                onSubmit={handleSubmit}
                onCancel={handleClose}
                isLoading={isLoading}
                roomType={roomType}
                roomId={roomId}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
