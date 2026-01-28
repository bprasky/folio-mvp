'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  RidgeCard,
  RidgeCardHeader,
  RidgeCardTitle,
  RidgeCardContent,
} from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ShopProduct {
  id: string;
  productId: string;
  quote: string | null;
  isFeatured: boolean;
  isActive: boolean;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    brand: string | null;
  };
  views: number;
  saves: number;
  boostStatus: 'BOOSTED' | 'PENDING' | null;
}

interface PendingBoost {
  id: string;
  shopProductId: string;
  vendorName: string;
  productName: string;
  startDate: string;
  endDate: string;
  designerCredit: number;
}

interface DashboardStats {
  totalProducts: number;
  viewsThisMonth: number;
  earningsThisMonth: number;
  productsNeedingQuotes: number;
  pendingBoosts: number;
}

export default function DesignerShopDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [pendingBoosts, setPendingBoosts] = useState<PendingBoost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [editQuote, setEditQuote] = useState('');
  const [editFeatured, setEditFeatured] = useState(false);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Remove confirmation state
  const [removingProduct, setRemovingProduct] = useState<ShopProduct | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/designer/shop');
      return;
    }

    if (status === 'authenticated') {
      fetchDashboardData();
    }
  }, [status, router]);

  async function fetchDashboardData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/designer/shop');
      if (!response.ok) {
        throw new Error('Failed to fetch shop data');
      }

      const data = await response.json();
      setStats(data.stats);
      setProducts(data.products || []);
      setPendingBoosts(data.pendingBoosts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  function openEditModal(product: ShopProduct) {
    setEditingProduct(product);
    setEditQuote(product.quote || '');
    setEditFeatured(product.isFeatured);
    setEditActive(product.isActive);
  }

  async function saveProductChanges() {
    if (!editingProduct) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/designer/shop/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote: editQuote || null,
          isFeatured: editFeatured,
          isActive: editActive,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update product');
      }

      // Refresh data
      await fetchDashboardData();
      setEditingProduct(null);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct() {
    if (!removingProduct) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/designer/shop/products/${removingProduct.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove product');
      }

      await fetchDashboardData();
      setRemovingProduct(null);
    } catch (err) {
      console.error('Failed to remove:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleBoostAction(boostId: string, action: 'approve' | 'decline') {
    try {
      const response = await fetch(`/api/designer/shop/boosts/${boostId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} boost`);
      }

      await fetchDashboardData();
    } catch (err) {
      console.error(`Failed to ${action} boost:`, err);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-elevated)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-elevated)] p-8">
        <div className="max-w-6xl mx-auto">
          <RidgeCard>
            <RidgeCardContent className="p-6">
              <p className="text-red-500">{error}</p>
              <Button variant="ridge" className="mt-4" onClick={fetchDashboardData}>
                Retry
              </Button>
            </RidgeCardContent>
          </RidgeCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-elevated)]">
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">My Shop</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Manage your curated product collection
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <RidgeCard>
            <RidgeCardContent className="p-6">
              <p className="text-[var(--text-tertiary)] text-sm">Total Products</p>
              <p className="text-3xl font-semibold text-[var(--text-primary)] mt-1">
                {stats?.totalProducts || 0}
              </p>
            </RidgeCardContent>
          </RidgeCard>

          <RidgeCard>
            <RidgeCardContent className="p-6">
              <p className="text-[var(--text-tertiary)] text-sm">Views This Month</p>
              <p className="text-3xl font-semibold text-[var(--text-primary)] mt-1">
                {stats?.viewsThisMonth || 0}
              </p>
            </RidgeCardContent>
          </RidgeCard>

          <RidgeCard>
            <RidgeCardContent className="p-6">
              <p className="text-[var(--text-tertiary)] text-sm">Earnings This Month</p>
              <p className="text-3xl font-semibold text-[var(--accent)] mt-1">
                ${stats?.earningsThisMonth?.toFixed(2) || '0.00'}
              </p>
            </RidgeCardContent>
          </RidgeCard>
        </div>

        {/* Pending Actions */}
        {((stats?.productsNeedingQuotes || 0) > 0 || (stats?.pendingBoosts || 0) > 0) && (
          <RidgeCard className="mb-8">
            <RidgeCardHeader>
              <RidgeCardTitle>Pending Actions</RidgeCardTitle>
            </RidgeCardHeader>
            <RidgeCardContent className="p-6">
              <div className="space-y-3">
                {(stats?.productsNeedingQuotes || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">
                      {stats?.productsNeedingQuotes} product{stats?.productsNeedingQuotes !== 1 ? 's' : ''} awaiting quotes
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => {}}>
                      Add Quotes
                    </Button>
                  </div>
                )}
                {(stats?.pendingBoosts || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">
                      {stats?.pendingBoosts} boost request{stats?.pendingBoosts !== 1 ? 's' : ''} pending
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => {}}>
                      Review
                    </Button>
                  </div>
                )}
              </div>
            </RidgeCardContent>
          </RidgeCard>
        )}

        {/* Products Grid */}
        <RidgeCard className="mb-8">
          <RidgeCardHeader>
            <RidgeCardTitle>Products ({products.length})</RidgeCardTitle>
          </RidgeCardHeader>
          <RidgeCardContent className="p-6">
            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[var(--text-tertiary)]">
                  No products in your shop yet. Tag products in your projects and add them to your shop.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${
                      product.isActive ? 'border-[var(--border)]' : 'border-[var(--border)] opacity-50'
                    }`}
                  >
                    {/* Product Image */}
                    <div className="w-16 h-16 rounded-lg bg-[var(--bg-inset)] overflow-hidden flex-shrink-0">
                      {product.product.imageUrl ? (
                        <Image
                          src={product.product.imageUrl}
                          alt={product.product.name}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)]">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">
                        {product.product.name}
                      </p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        {product.product.brand || 'Unknown Vendor'}
                      </p>
                    </div>

                    {/* Quote Status */}
                    <div className="hidden md:block text-sm text-[var(--text-tertiary)]">
                      {product.quote ? 'Has quote' : 'Needs quote'}
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex gap-6 text-sm">
                      <span className="text-[var(--text-tertiary)]">{product.views} views</span>
                      <span className="text-[var(--text-tertiary)]">{product.saves} saves</span>
                    </div>

                    {/* Boost Status */}
                    <div className="hidden md:block">
                      {product.boostStatus === 'BOOSTED' && (
                        <span className="px-2 py-1 bg-[var(--accent)] text-white text-xs rounded-full">
                          Boosted
                        </span>
                      )}
                      {product.boostStatus === 'PENDING' && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(product)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemovingProduct(product)}
                        className="text-red-500 hover:text-red-600"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </RidgeCardContent>
        </RidgeCard>

        {/* Pending Boosts */}
        {pendingBoosts.length > 0 && (
          <RidgeCard>
            <RidgeCardHeader>
              <RidgeCardTitle>Pending Boost Requests</RidgeCardTitle>
            </RidgeCardHeader>
            <RidgeCardContent className="p-6">
              <div className="space-y-4">
                {pendingBoosts.map((boost) => (
                  <div
                    key={boost.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-[var(--border)]"
                  >
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        {boost.vendorName}
                      </p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        {boost.productName}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        {new Date(boost.startDate).toLocaleDateString()} - {new Date(boost.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[var(--accent)] font-semibold">
                        ${boost.designerCredit.toFixed(2)}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">in Folio Credit</p>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={() => handleBoostAction(boost.id, 'approve')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBoostAction(boost.id, 'decline')}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </RidgeCardContent>
          </RidgeCard>
        )}

        {/* Edit Modal */}
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Shop Product</DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Quote
                </label>
                <textarea
                  value={editQuote}
                  onChange={(e) => setEditQuote(e.target.value)}
                  placeholder="What makes this product special?"
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg-base)] text-[var(--text-primary)] resize-none"
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  {editQuote.length}/500 characters
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="featured"
                  checked={editFeatured}
                  onChange={(e) => setEditFeatured(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="featured" className="text-sm text-[var(--text-primary)]">
                  Pin to top of shop
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="active"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="active" className="text-sm text-[var(--text-primary)]">
                  Show in shop (uncheck to hide)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setEditingProduct(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="accent" onClick={saveProductChanges} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove Confirmation Modal */}
        <Dialog open={!!removingProduct} onOpenChange={() => setRemovingProduct(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove from Shop?</DialogTitle>
            </DialogHeader>
            <div className="p-6">
              <p className="text-[var(--text-secondary)] mb-6">
                This won&apos;t affect your project tags or vendor attribution data.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setRemovingProduct(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={removeProduct} disabled={saving}>
                  {saving ? 'Removing...' : 'Remove'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
