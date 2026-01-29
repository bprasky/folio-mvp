'use client';

import { useState, useEffect, useMemo } from 'react';
import { FaUpload, FaLink, FaSpinner, FaMagic, FaSearch, FaUser, FaEnvelope, FaPhone, FaPlus } from 'react-icons/fa';
import AddRepContactModal from './AddRepContactModal';

interface VendorRepContact {
  id: string;
  repName: string;
  repEmail?: string | null;
  repPhone?: string | null;
  repTitle?: string | null;
  vendorName: string;
  hasTradeAccount: boolean;
  tradeDiscount?: number | null;
}

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
  specConfidence?: 'high' | 'partial' | 'visual_only';
}

interface ProductFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<ProductFormData>;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  roomType?: string;
  roomId?: string;
  selectionId?: string;
  /** When true, shows the "Complete Product Specs" section for AI-assisted completion */
  fromPresentationImport?: boolean;
}

export default function ProductForm({
  mode,
  initialData = {},
  onSubmit,
  onCancel,
  isLoading = false,
  roomType,
  roomId,
  selectionId,
  fromPresentationImport = false
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
    specConfidence: 'visual_only',
    ...initialData
  });

  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [isFolioSearching, setIsFolioSearching] = useState(false);
  const [repContact, setRepContact] = useState<VendorRepContact | null>(null);
  const [isLoadingRep, setIsLoadingRep] = useState(false);
  const [isRequestingSpec, setIsRequestingSpec] = useState(false);
  const [showAddRepModal, setShowAddRepModal] = useState(false);

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

  // Fetch rep contact when vendor name changes
  useEffect(() => {
    const vendorName = formData.vendorName || formData.brand;
    if (!vendorName || vendorName.length < 2) {
      setRepContact(null);
      return;
    }

    const fetchRepContact = async () => {
      setIsLoadingRep(true);
      try {
        const response = await fetch(`/api/rep-contacts?vendorName=${encodeURIComponent(vendorName)}`);
        if (response.ok) {
          const data = await response.json();
          setRepContact(data.contact || null);
        } else {
          setRepContact(null);
        }
      } catch (error) {
        console.error('Failed to fetch rep contact:', error);
        setRepContact(null);
      } finally {
        setIsLoadingRep(false);
      }
    };

    // Debounce the fetch
    const timer = setTimeout(fetchRepContact, 500);
    return () => clearTimeout(timer);
  }, [formData.vendorName, formData.brand]);

  // Request spec from rep via email
  const handleRequestSpecFromRep = async () => {
    if (!repContact?.repEmail) {
      setImportError('No email address for this rep');
      return;
    }

    setIsRequestingSpec(true);
    setImportError('');

    try {
      const response = await fetch('/api/rep-contacts/request-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repContactId: repContact.id,
          productName: formData.name,
          vendorName: formData.vendorName || formData.brand,
          sku: formData.sku,
          selectionId,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to send request');
      }

      // Show success (could use a toast here)
      setImportError(''); // Clear any previous error
      alert(`Spec request sent to ${repContact.repName} at ${repContact.repEmail}`);
    } catch (error: any) {
      setImportError(error.message || 'Failed to request spec from rep');
    } finally {
      setIsRequestingSpec(false);
    }
  };

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
          vendorName: importedData.vendorName || formData.vendorName,
          priceCents: importedData.price ? Math.round(importedData.price * 100).toString() : formData.priceCents,
          currency: importedData.currency || formData.currency,
          // Always update the URL field
          url: importedData.url || formData.url,
          // Update dimensions if provided
          dimensions: importedData.dimensions ? {
            widthIn: importedData.dimensions.width,
            depthIn: importedData.dimensions.depth,
            heightIn: importedData.dimensions.height,
          } : formData.dimensions,
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

  // AI-powered web search to complete missing product specs
  const handleCompleteWithAi = async () => {
    if (!formData.name && !formData.vendorName && !formData.imageUrl) {
      setImportError('Need at least a product name, vendor, or image to search');
      return;
    }

    setIsAiSearching(true);
    setImportError('');

    try {
      const response = await fetch('/api/ai/complete-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: formData.name,
          vendorName: formData.vendorName || formData.brand,
          description: formData.description,
          imageUrl: formData.imageUrl,
          selectionId,
          existingData: {
            sku: formData.sku,
            price: formData.priceCents,
            dimensions: formData.dimensions,
            url: formData.url
          }
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'AI search failed');
      }

      if (result.data) {
        // Merge AI results with existing data (don't overwrite existing values)
        setFormData(prev => ({
          ...prev,
          name: prev.name || result.data.productName || prev.name,
          vendorName: prev.vendorName || result.data.vendorName || prev.vendorName,
          brand: prev.brand || result.data.brand || prev.brand,
          sku: prev.sku || result.data.sku || prev.sku,
          priceCents: prev.priceCents || (result.data.price ? Math.round(result.data.price * 100).toString() : prev.priceCents),
          url: prev.url || result.data.productUrl || prev.url,
          imageUrl: prev.imageUrl || result.data.imageUrl || prev.imageUrl,
          description: prev.description || result.data.description || prev.description,
          dimensions: {
            widthIn: prev.dimensions?.widthIn || result.data.dimensions?.width,
            depthIn: prev.dimensions?.depthIn || result.data.dimensions?.depth,
            heightIn: prev.dimensions?.heightIn || result.data.dimensions?.height,
          },
          specConfidence: 'high' // Update confidence after AI completion
        }));
      }
    } catch (error: any) {
      setImportError(error.message || 'AI search failed');
    } finally {
      setIsAiSearching(false);
    }
  };

  // Search within Folio's product database for a matching spec
  const handleFindInFolio = async () => {
    if (!formData.name && !formData.description && !formData.imageUrl) {
      setImportError('Need a product name, description, or image to search Folio');
      return;
    }

    setIsFolioSearching(true);
    setImportError('');

    try {
      const response = await fetch('/api/ai/find-in-folio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: formData.name,
          description: formData.description,
          imageUrl: formData.imageUrl,
          category: formData.slotKey || undefined,
          selectionId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Folio search failed');
      }

      if (result.data && result.data.match) {
        // Found a match - offer to apply it
        const match = result.data.match;
        setFormData(prev => ({
          ...prev,
          name: match.productName || prev.name,
          vendorName: match.vendorName || prev.vendorName,
          brand: match.brand || prev.brand,
          sku: match.sku || prev.sku,
          priceCents: match.unitPrice ? Math.round(Number(match.unitPrice) * 100).toString() : prev.priceCents,
          url: match.productUrl || prev.url,
          imageUrl: match.photo || prev.imageUrl,
          dimensions: match.dimensions || prev.dimensions,
          specConfidence: 'high'
        }));
      } else {
        setImportError('No matching product found in Folio. Try "Complete with AI" for a web search.');
      }
    } catch (error: any) {
      setImportError(error.message || 'Folio search failed');
    } finally {
      setIsFolioSearching(false);
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

      {/* AI Search Section - only show when from presentation import with incomplete data */}
      {fromPresentationImport && (formData.name || formData.imageUrl) && (!formData.priceCents || !formData.vendorName || !formData.sku) && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-purple-900 mb-2">
            Complete Product Specs
          </h3>
          <p className="text-xs text-purple-700 mb-3">
            Search Folio&apos;s database or use AI to find complete product specifications.
          </p>
          <div className="flex gap-2">
            {/* Find in Folio - search internal database */}
            <button
              type="button"
              onClick={handleFindInFolio}
              disabled={isFolioSearching || isAiSearching}
              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              {isFolioSearching ? (
                <FaSpinner className="w-4 h-4 animate-spin" />
              ) : (
                <FaSearch className="w-4 h-4" />
              )}
              Find in Folio
            </button>
            {/* Complete with AI - web search */}
            <button
              type="button"
              onClick={handleCompleteWithAi}
              disabled={isAiSearching || isFolioSearching}
              className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              {isAiSearching ? (
                <FaSpinner className="w-4 h-4 animate-spin" />
              ) : (
                <FaMagic className="w-4 h-4" />
              )}
              Complete with AI
            </button>
          </div>
        </div>
      )}

      {/* Rep Contact Section - show in edit mode when vendor is set */}
      {mode === 'edit' && (formData.vendorName || formData.brand) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-amber-900 mb-2 flex items-center gap-2">
            <FaUser className="w-4 h-4" />
            Vendor Rep Contact
          </h3>

          {isLoadingRep ? (
            <div className="flex items-center gap-2 text-amber-700 text-sm">
              <FaSpinner className="w-4 h-4 animate-spin" />
              Looking up rep...
            </div>
          ) : repContact ? (
            <div className="space-y-2">
              <div className="text-sm text-amber-800">
                <span className="font-medium">{repContact.repName}</span>
                {repContact.repTitle && (
                  <span className="text-amber-600"> - {repContact.repTitle}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-amber-700">
                {repContact.repEmail && (
                  <span className="flex items-center gap-1">
                    <FaEnvelope className="w-3 h-3" />
                    {repContact.repEmail}
                  </span>
                )}
                {repContact.repPhone && (
                  <span className="flex items-center gap-1">
                    <FaPhone className="w-3 h-3" />
                    {repContact.repPhone}
                  </span>
                )}
              </div>
              {repContact.hasTradeAccount && repContact.tradeDiscount && (
                <div className="text-xs text-amber-600">
                  Trade account: {Number(repContact.tradeDiscount)}% discount
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleRequestSpecFromRep}
                  disabled={isRequestingSpec || !repContact.repEmail}
                  className="flex-1 px-3 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                >
                  {isRequestingSpec ? (
                    <FaSpinner className="w-4 h-4 animate-spin" />
                  ) : (
                    <FaEnvelope className="w-4 h-4" />
                  )}
                  Request Spec from Rep
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-amber-700">
                No rep contact saved for {formData.vendorName || formData.brand}.
              </p>
              <button
                type="button"
                onClick={() => setShowAddRepModal(true)}
                className="px-3 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-md hover:bg-amber-200 text-sm flex items-center gap-2"
              >
                <FaPlus className="w-3 h-3" />
                Add Rep Contact
              </button>
            </div>
          )}
        </div>
      )}

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

      {/* Add Rep Contact Modal */}
      <AddRepContactModal
        isOpen={showAddRepModal}
        onClose={() => setShowAddRepModal(false)}
        vendorName={formData.vendorName || formData.brand || ''}
        onSuccess={(contact) => {
          setRepContact(contact);
          setShowAddRepModal(false);
        }}
      />
    </form>
  );
}
