'use client'
import { useState, useEffect } from 'react'

type Product = {
  id: string
  name: string
  sku?: string
  finish?: string
  price?: number
  imageUrl?: string
  vendorId?: string
  vendorName?: string
}

type CatalogPickerProps = {
  scopeVendorId?: string | null;     // when present, filter results to that vendor
  allowAllVendors?: boolean;         // if true, user can clear scope
  onPick(product: Product): void;
  disabled?: boolean;
}

export default function CatalogPicker({ 
  scopeVendorId, 
  allowAllVendors = true, 
  onPick, 
  disabled = false 
}: CatalogPickerProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAllVendors, setShowAllVendors] = useState(!scopeVendorId)

  useEffect(() => {
    fetchProducts()
  }, [searchQuery, showAllVendors, scopeVendorId])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      if (scopeVendorId && !showAllVendors) params.set('vendorId', scopeVendorId)
      
      const response = await fetch(`/api/products/search?${params}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProductPick = (product: Product) => {
    onPick(product)
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          disabled={disabled}
        />
      </div>

      {/* Vendor Scope Toggle */}
      {scopeVendorId && allowAllVendors && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAllVendors}
              onChange={(e) => setShowAllVendors(e.target.checked)}
              className="rounded"
            />
            Browse all vendors
          </label>
          {!showAllVendors && (
            <span className="text-xs text-gray-500">
              Showing only your products
            </span>
          )}
        </div>
      )}

      {/* Products List */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No products found</div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
              onClick={() => handleProductPick(product)}
            >
              <div className="flex items-start gap-3">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{product.name}</h4>
                  {product.sku && (
                    <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                  )}
                  {product.finish && (
                    <p className="text-xs text-gray-500">Finish: {product.finish}</p>
                  )}
                  {product.vendorName && (
                    <p className="text-xs text-blue-600">{product.vendorName}</p>
                  )}
                  {product.price && (
                    <p className="text-xs font-medium">${product.price}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}




