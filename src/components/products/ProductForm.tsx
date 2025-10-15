'use client';

import { useState, useEffect, useMemo } from 'react';
import { FaUpload, FaLink, FaSpinner } from 'react-icons/fa';

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
  dimensions?: {
    widthIn?: number;
    depthIn?: number;
    heightIn?: number;
  };
  slotKey?: string;
}

interface ProductFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<ProductFormData>;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  roomType?: string;
  roomId?: string;
}

export default function ProductForm({ 
  mode, 
  initialData = {}, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  roomType,
  roomId
}: ProductFormProps) {
  const [formData, setFormData] = useState<ProductFormData>({
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
    },
    slotKey: '',
    ...initialData
  });

  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Get room template for role options
  const roomTemplate = useMemo(() => {
    if (!roomType) return null;
    
    // Import room templates dynamically to avoid circular dependencies
    const getRoomTemplate = (type: string) => {
      const templates: Record<string, any> = {
        KITCHEN: {
          slots: [
            { key: 'countertop', label: 'Countertop', defaultSize: 'large' },
            { key: 'backsplash', label: 'Backsplash', defaultSize: 'medium' },
            { key: 'sink', label: 'Sink', defaultSize: 'medium' },
            { key: 'faucet', label: 'Faucet', defaultSize: 'small' },
            { key: 'appliances', label: 'Appliances', defaultSize: 'large' },
            { key: 'lighting', label: 'Lighting', defaultSize: 'small' },
            { key: 'island', label: 'Island', defaultSize: 'large' }
          ]
        },
        LIVING: {
          slots: [
            { key: 'sofa', label: 'Sofa', defaultSize: 'large' },
            { key: 'rug', label: 'Rug', defaultSize: 'large' },
            { key: 'coffee-table', label: 'Coffee Table', defaultSize: 'medium' },
            { key: 'art', label: 'Art', defaultSize: 'medium' },
            { key: 'accent-chairs', label: 'Accent Chairs', defaultSize: 'medium' },
            { key: 'storage', label: 'Storage', defaultSize: 'large' }
          ]
        },
        BEDROOM: {
          slots: [
            { key: 'bed', label: 'Bed', defaultSize: 'large' },
            { key: 'nightstands', label: 'Nightstands', defaultSize: 'medium' },
            { key: 'dresser', label: 'Dresser', defaultSize: 'large' }
          ]
        },
        BATHROOM: {
          slots: [
            { key: 'wall-tile', label: 'Wall Tile', defaultSize: 'medium' },
            { key: 'floor-tile', label: 'Floor Tile', defaultSize: 'medium' },
            { key: 'shower-system', label: 'Shower System', defaultSize: 'large' }
          ]
        }
      };
      return templates[type] || null;
    };
    
    return getRoomTemplate(roomType);
  }, [roomType]);

  // Update form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const handleInputChange = (field: keyof ProductFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImportFromUrl = async () => {
    if (!formData.url.trim()) {
      setImportError('Please enter a URL first');
      return;
    }

    setIsImporting(true);
    setImportError('');

    try {
      const response = await fetch('/api/import/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formData.url }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import product data');
      }

      if (result.data) {
        const importedData = result.data;
        
        console.log('ProductForm received imported data:', importedData);
        console.log('Current form data before merge:', formData);
        console.log('Replace existing flag:', replaceExisting);
        
        // Merge imported data, respecting replaceExisting flag
        const newFormData = {
          ...formData,
          // Always update these fields if they exist in imported data
          name: importedData.title || formData.name,
          description: importedData.description || formData.description,
          imageUrl: importedData.imageUrl || formData.imageUrl,
          sku: importedData.sku || formData.sku,
          brand: importedData.brand || formData.brand,
          priceCents: importedData.price ? Math.round(importedData.price * 100).toString() : formData.priceCents,
          currency: importedData.currency || formData.currency,
          // Always update the URL field
          url: importedData.url || formData.url,
        };
        
        console.log('New form data after merge:', newFormData);
        setFormData(newFormData);

        // Track successful import
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'import_url_success', {
            event_category: 'product_form',
            event_label: 'url_import'
          });
        }
      }
    } catch (error: any) {
      setImportError(error.message || 'Failed to import product data');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setImportError('Product name is required');
      return;
    }

    console.log('Form submitting with data:', formData);

    try {
      await onSubmit(formData);
      console.log('Form submitted successfully');
    } catch (error: any) {
      console.error('Form submission error:', error);
      setImportError(error.message || 'Failed to save product');
    }
  };

  const formatPrice = (priceCents: string) => {
    if (!priceCents) return '';
    const price = Number(priceCents) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: formData.currency || 'USD'
    }).format(price);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* URL Import Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-3 flex items-center gap-2">
          <FaLink className="w-4 h-4" />
          Import from URL
        </h3>
        
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://example.com/product"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleImportFromUrl}
              disabled={isImporting || !formData.url.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
            >
              {isImporting ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaLink className="w-4 h-4" />}
              Import
            </button>
          </div>
          
        </div>
      </div>

      {/* Error Display */}
      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{importError}</p>
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Enter product name"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SKU
          </label>
          <input
            type="text"
            value={formData.sku}
            onChange={(e) => handleInputChange('sku', e.target.value)}
            placeholder="Product SKU"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Brand
          </label>
          <input
            type="text"
            value={formData.brand}
            onChange={(e) => handleInputChange('brand', e.target.value)}
            placeholder="Brand name"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vendor Name
          </label>
          <input
            type="text"
            value={formData.vendorName}
            onChange={(e) => handleInputChange('vendorName', e.target.value)}
            placeholder="Vendor or retailer name"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price (cents)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={formData.priceCents}
              onChange={(e) => handleInputChange('priceCents', e.target.value)}
              placeholder="12900"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={formData.currency}
              onChange={(e) => handleInputChange('currency', e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
            </select>
          </div>
          {formData.priceCents && (
            <p className="text-xs text-gray-500 mt-1">
              {formatPrice(formData.priceCents)}
            </p>
          )}
        </div>

        {/* Dimensions Section */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dimensions (inches)
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width</label>
              <input
                type="number"
                step="0.1"
                value={formData.dimensions?.widthIn || ''}
                onChange={(e) => handleInputChange('dimensions', {
                  ...formData.dimensions,
                  widthIn: e.target.value ? Number(e.target.value) : undefined
                })}
                placeholder="24"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Depth</label>
              <input
                type="number"
                step="0.1"
                value={formData.dimensions?.depthIn || ''}
                onChange={(e) => handleInputChange('dimensions', {
                  ...formData.dimensions,
                  depthIn: e.target.value ? Number(e.target.value) : undefined
                })}
                placeholder="18"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Height</label>
              <input
                type="number"
                step="0.1"
                value={formData.dimensions?.heightIn || ''}
                onChange={(e) => handleInputChange('dimensions', {
                  ...formData.dimensions,
                  heightIn: e.target.value ? Number(e.target.value) : undefined
                })}
                placeholder="30"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Role in Room Section */}
        {roomTemplate && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role in this room
            </label>
            <select
              value={formData.slotKey || ''}
              onChange={(e) => handleInputChange('slotKey', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None / Unassigned</option>
              {roomTemplate.slots.map((slot: any) => (
                <option key={slot.key} value={slot.key}>
                  {slot.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              This sets the item's purpose on the board (e.g., Accent Chair, Rug, Countertop). It controls which placeholder it replaces.
            </p>
          </div>
        )}

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product URL
          </label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => handleInputChange('url', e.target.value)}
            placeholder="https://example.com/product"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Product description"
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Image URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={formData.imageUrl}
              onChange={(e) => handleInputChange('imageUrl', e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm flex items-center gap-2"
            >
              <FaUpload className="w-4 h-4" />
              Upload
            </button>
          </div>
          {formData.imageUrl && (
            <div className="mt-2">
              <img
                src={formData.imageUrl}
                alt="Product preview"
                className="w-20 h-20 object-cover rounded border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !formData.name.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {isLoading ? 'Saving...' : mode === 'create' ? 'Create Product' : 'Update Product'}
        </button>
      </div>
    </form>
  );
}
