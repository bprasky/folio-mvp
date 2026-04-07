'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaTimes, FaGripVertical } from 'react-icons/fa';
import { useDebounce } from '@/lib/hooks/useDebounce';

type UIProduct = {
  id: string;
  name: string;
  imageUrl?: string;
  vendorName?: string | null;
};

interface FeaturedProductsPickerProps {
  selectedProducts: UIProduct[];
  onProductsChange: (products: UIProduct[]) => void;
}

export default function FeaturedProductsPicker({ 
  selectedProducts, 
  onProductsChange 
}: FeaturedProductsPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UIProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Search products when search term changes
  useEffect(() => {
    if (!debouncedSearchTerm.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const searchProducts = async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(debouncedSearchTerm)}&limit=10`);
        if (response.ok) {
          const results = await response.json();
          // Filter out already selected products
          const filteredResults = results.filter((product: UIProduct) => 
            !selectedProducts.some(selected => selected.id === product.id)
          );
          setSearchResults(filteredResults);
          setShowDropdown(true);
        }
      } catch (error) {
        console.error('Product search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchProducts();
  }, [debouncedSearchTerm, selectedProducts]);

  const addProduct = useCallback((product: UIProduct) => {
    if (!selectedProducts.some(p => p.id === product.id)) {
      onProductsChange([...selectedProducts, product]);
    }
    setSearchTerm('');
    setShowDropdown(false);
  }, [selectedProducts, onProductsChange]);

  const removeProduct = useCallback((productId: string) => {
    onProductsChange(selectedProducts.filter(p => p.id !== productId));
  }, [selectedProducts, onProductsChange]);

  const moveProduct = useCallback((fromIndex: number, toIndex: number) => {
    const newProducts = [...selectedProducts];
    const [movedProduct] = newProducts.splice(fromIndex, 1);
    newProducts.splice(toIndex, 0, movedProduct);
    onProductsChange(newProducts);
  }, [selectedProducts, onProductsChange]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-folio-text-secondary mb-2">
          Featured Products
        </label>
        
        {/* Search Input */}
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search products to add..."
              className="w-full px-3 py-2 pl-10 border border-folio-border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent"
            />
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-folio-text-tertiary" />
          </div>

          {/* Search Results Dropdown */}
          {showDropdown && (searchResults.length > 0 || isSearching) && (
            <div className="absolute z-10 w-full mt-1 bg-surface-canvas border border-folio-border-subtle rounded-md shadow-lg max-h-60 overflow-y-auto">
              {isSearching ? (
                <div className="px-3 py-2 text-sm text-folio-text-tertiary">Searching...</div>
              ) : (
                searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addProduct(product)}
                    className="w-full px-3 py-2 text-left hover:bg-surface-ground flex items-center space-x-3"
                  >
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-8 h-8 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{product.name}</div>
                      {product.vendorName && (
                        <div className="text-xs text-folio-text-tertiary truncate">{product.vendorName}</div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selected Products */}
        {selectedProducts.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium text-folio-text-secondary mb-2">
              Selected Products ({selectedProducts.length})
            </div>
            <div className="space-y-2">
              {selectedProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center space-x-3 p-3 border border-folio-border-subtle rounded-md bg-surface-ground"
                >
                  <FaGripVertical className="text-folio-text-tertiary cursor-move" />
                  
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{product.name}</div>
                    {product.vendorName && (
                      <div className="text-xs text-folio-text-tertiary truncate">{product.vendorName}</div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => removeProduct(product.id)}
                    className="text-folio-text-tertiary hover:text-red-500"
                  >
                    <FaTimes />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Products Message */}
        {selectedProducts.length === 0 && (
          <div className="mt-4 p-4 border border-dashed border-folio-border-subtle rounded-md bg-surface-ground text-center">
            <p className="text-sm text-folio-text-tertiary">
              No featured products selected. Search above to add products.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 