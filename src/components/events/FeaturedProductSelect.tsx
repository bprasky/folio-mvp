'use client';

import { useEffect, useState } from 'react';
import { Search, X, Plus, Package } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  thumbnailUrl?: string | null;
  vendor?: { name: string } | null;
}

interface FeaturedProductSelectProps {
  value?: Product[];
  onChange: (products: Product[]) => void;
  vendorId?: string;
}

export default function FeaturedProductSelect({
  value = [],
  onChange,
  vendorId,
}: FeaturedProductSelectProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const searchProducts = async () => {
      if (!query) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const url = new URL('/api/search/products', window.location.origin);
        url.searchParams.set('q', query);
        if (vendorId) {
          url.searchParams.set('vendorId', vendorId);
        }

        const response = await fetch(url.toString());
        const data = await response.json();
        setResults(data.items || []);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [query, vendorId]);

  const addProduct = (product: Product) => {
    if (value.some((p) => p.id === product.id)) {
      return; // Already added
    }
    onChange([...value, product]);
    setQuery('');
    setShowResults(false);
  };

  const removeProduct = (productId: string) => {
    onChange(value.filter((p) => p.id !== productId));
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search products by name or brand..."
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 px-4 py-2 pl-10 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        </div>

        {/* Search Results Dropdown */}
        {showResults && query && (
          <div className="absolute z-10 mt-2 w-full max-h-64 overflow-auto rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-lg">
            {isSearching ? (
              <div className="px-4 py-8 text-center text-sm text-stone-500 dark:text-stone-400">
                Searching...
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-500 dark:text-stone-400">
                No products found
              </div>
            ) : (
              <div>
                {results.map((product) => {
                  const isAdded = value.some((p) => p.id === product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => !isAdded && addProduct(product)}
                      disabled={isAdded}
                      className="flex w-full items-center gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-b border-stone-200 dark:border-stone-700 last:border-0"
                    >
                      <div className="h-10 w-10 rounded overflow-hidden bg-stone-100 dark:bg-stone-800 flex-shrink-0">
                        {product.thumbnailUrl ? (
                          <img
                            src={product.thumbnailUrl}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Package className="w-4 h-4 text-stone-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                          {product.name}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          {product.vendor?.name || 'Unknown'} • {product.sku || '—'}
                        </div>
                      </div>
                      {isAdded ? (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                          Added
                        </span>
                      ) : (
                        <Plus className="w-4 h-4 text-stone-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Products */}
      {value.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-stone-700 dark:text-stone-300">
            Featured Products ({value.length})
          </div>
          <div className="space-y-2">
            {value.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2"
              >
                <div className="h-8 w-8 rounded overflow-hidden bg-stone-100 dark:bg-stone-700 flex-shrink-0">
                  {product.thumbnailUrl ? (
                    <img
                      src={product.thumbnailUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Package className="w-3 h-3 text-stone-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                    {product.name}
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">
                    {product.vendor?.name || 'Unknown'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeProduct(product.id)}
                  className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}




