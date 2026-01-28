'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ShopProductModal from '@/components/shop/ShopProductModal';

interface ShopProduct {
  id: string;
  productId: string;
  quote: string | null;
  isFeatured: boolean;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    brand: string | null;
    category: string | null;
  };
  projectCount: number;
  hasActiveBoost: boolean;
}

interface ProfileShopProps {
  userId: string;
}

// Filter options
const PRODUCT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'Lighting', label: 'Lighting' },
  { value: 'Furniture', label: 'Furniture' },
  { value: 'Textiles', label: 'Textiles' },
  { value: 'Tile', label: 'Tile' },
  { value: 'Hardware', label: 'Hardware' },
  { value: 'Plumbing', label: 'Plumbing' },
  { value: 'Appliances', label: 'Appliances' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recent' },
  { value: 'popular', label: 'Popular' },
  { value: 'featured', label: 'Featured' },
];

export default function ProfileShop({ userId }: ProfileShopProps) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [vendors, setVendors] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [productType, setProductType] = useState('all');
  const [vendor, setVendor] = useState('all');
  const [sort, setSort] = useState('recent');

  // Modal state
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openProductModal = (shopProductId: string) => {
    setSelectedProductId(shopProductId);
    setIsModalOpen(true);
  };

  const closeProductModal = () => {
    setIsModalOpen(false);
    setSelectedProductId(null);
  };

  useEffect(() => {
    const fetchShopProducts = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          productType,
          vendor,
          sort,
        });

        const response = await fetch(`/api/profile/${userId}/shop?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch shop products');
        }

        const data = await response.json();
        setProducts(data.products || []);

        // Extract unique vendors for filter dropdown
        if (data.vendors) {
          setVendors([
            { value: 'all', label: 'All Vendors' },
            ...data.vendors.map((v: { id: string; name: string }) => ({
              value: v.id,
              label: v.name,
            })),
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchShopProducts();
  }, [userId, productType, vendor, sort]);

  if (loading) {
    return <ShopSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p style={{ color: '#8B8178' }}>Unable to load shop. Please try again.</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ backgroundColor: '#F5F3F0' }}
        >
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ color: '#8B8178' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-2" style={{ color: '#2C2825' }}>
          No products in shop yet
        </h3>
        <p style={{ color: '#8B8178' }}>
          Products added during project posting will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with count */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium" style={{ color: '#2C2825' }}>
          {products.length} Product{products.length !== 1 ? 's' : ''}
        </h2>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-4 mb-8">
        {/* Product Type Filter */}
        <select
          value={productType}
          onChange={(e) => setProductType(e.target.value)}
          className="px-4 py-2 rounded-lg border text-sm"
          style={{
            backgroundColor: '#FAF9F7',
            borderColor: '#E8E4DF',
            color: '#2C2825',
          }}
        >
          {PRODUCT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Vendor Filter */}
        <select
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          className="px-4 py-2 rounded-lg border text-sm"
          style={{
            backgroundColor: '#FAF9F7',
            borderColor: '#E8E4DF',
            color: '#2C2825',
          }}
        >
          {vendors.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-4 py-2 rounded-lg border text-sm ml-auto"
          style={{
            backgroundColor: '#FAF9F7',
            borderColor: '#E8E4DF',
            color: '#2C2825',
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((item) => (
          <ShopProductCard
            key={item.id}
            item={item}
            onOpenModal={openProductModal}
          />
        ))}
      </div>

      {/* Product Modal */}
      {selectedProductId && (
        <ShopProductModal
          shopProductId={selectedProductId}
          isOpen={isModalOpen}
          onClose={closeProductModal}
        />
      )}
    </div>
  );
}

function ShopProductCard({
  item,
  onOpenModal,
}: {
  item: ShopProduct;
  onOpenModal: (shopProductId: string) => void;
}) {
  return (
    <button
      onClick={() => onOpenModal(item.id)}
      className="group block rounded-xl overflow-hidden border transition-shadow hover:shadow-lg text-left w-full"
      style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DF' }}
    >
      {/* Product Image */}
      <div className="aspect-square relative" style={{ backgroundColor: '#F5F3F0' }}>
        {item.product.imageUrl ? (
          <Image
            src={item.product.imageUrl}
            alt={item.product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-12 h-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{ color: '#C4BEB5' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {item.hasActiveBoost && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#FF6B35', color: '#FFFFFF' }}
            >
              Featured
            </span>
          )}
          {item.isFeatured && !item.hasActiveBoost && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#2C2825', color: '#FFFFFF' }}
            >
              Pinned
            </span>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3
          className="font-medium text-sm mb-1 line-clamp-2"
          style={{ color: '#2C2825' }}
        >
          {item.product.name}
        </h3>
        <p className="text-sm mb-2" style={{ color: '#8B8178' }}>
          {item.product.brand || 'Unknown Vendor'}
        </p>
        <p className="text-xs" style={{ color: '#A9A29A' }}>
          In {item.projectCount} project{item.projectCount !== 1 ? 's' : ''}
        </p>
      </div>
    </button>
  );
}

function ShopSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div
          className="h-6 w-24 rounded animate-pulse"
          style={{ backgroundColor: '#E8E4DF' }}
        />
      </div>

      {/* Filter skeleton */}
      <div className="flex gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 w-32 rounded-lg animate-pulse"
            style={{ backgroundColor: '#E8E4DF' }}
          />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden animate-pulse"
            style={{ backgroundColor: '#F5F3F0' }}
          >
            <div className="aspect-square" style={{ backgroundColor: '#E8E4DF' }} />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 rounded" style={{ backgroundColor: '#E8E4DF' }} />
              <div className="h-3 w-1/2 rounded" style={{ backgroundColor: '#E8E4DF' }} />
              <div className="h-3 w-1/3 rounded" style={{ backgroundColor: '#E8E4DF' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
