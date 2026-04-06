import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Package } from 'lucide-react';
import { listVendors, listVendorProducts } from './actions';
import ProductsFilters from '@/components/vendor/products/ProductsFilters';
import { ProductThumbnail } from '@/components/vendor/products/ProductThumbnail';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

interface SearchParams {
  vendorId?: string;
  q?: string;
  includeDrafts?: string;
  page?: string;
  pageSize?: string;
}

async function ProductsContent({ searchParams }: { searchParams: SearchParams }) {
  const vendors = await listVendors();
  
  const data = await listVendorProducts({
    vendorUserId: searchParams.vendorId || null,
    q: searchParams.q || null,
    includeDrafts: (searchParams.includeDrafts || '1') === '1',
    page: Number(searchParams.page) || 1,
    pageSize: Number(searchParams.pageSize) || 20,
  });

  const currentPage = data.page;
  const q = searchParams.q || '';
  const vendorId = searchParams.vendorId || '';
  const includeDrafts = searchParams.includeDrafts !== '0';

  const buildUrl = (newPage: number) => {
    const params = new URLSearchParams();
    params.set('page', newPage.toString());
    if (q) params.set('q', q);
    if (vendorId) params.set('vendorId', vendorId);
    if (!includeDrafts) params.set('includeDrafts', '0');
    return `/vendor/products?${params.toString()}`;
  };

  return (
    <>
      <ProductsFilters vendors={vendors} />

      {data.items.length === 0 ? (
        <RidgeCard padding="xl" className="text-center">
          <p className="folio-body text-folio-text-secondary mb-4">No products found</p>
          <Link href="/vendor/products/new">
            <Button variant="accent">
              + Add Your First Product
            </Button>
          </Link>
        </RidgeCard>
      ) : (
        <RidgeCard padding="none" className="overflow-hidden">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-ground text-folio-text-tertiary border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Brand</th>
                  <th className="px-4 py-3 text-left font-medium">Vendor</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((product) => (
                  <tr
                    key={product.id}
                    className="border-t border-[var(--border-subtle)] hover:bg-surface-ground transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={product.href}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <ProductThumbnail
                          imageUrl={product.imageUrl}
                          productName={product.name}
                        />
                        <span className="text-folio-text-primary font-medium">
                          {product.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-folio-text-secondary">
                      {product.skuOrBrand}
                    </td>
                    <td className="px-4 py-3 text-folio-text-secondary">
                      {product.vendorName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          product.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 folio-meta">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/vendor/products/${product.id}`}>
                        <Button variant="ridge" size="sm">
                          Manage
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)] text-sm">
            <span className="folio-meta">
              {(currentPage - 1) * data.pageSize + 1}–
              {Math.min(currentPage * data.pageSize, data.total)} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={buildUrl(Math.max(1, currentPage - 1))}
                className={currentPage === 1 ? 'opacity-50 pointer-events-none' : ''}
              >
                <Button variant="ridge" size="sm">
                  Previous
                </Button>
              </Link>
              <span className="folio-meta">
                Page {currentPage} of {data.totalPages}
              </span>
              <Link
                href={buildUrl(Math.min(data.totalPages, currentPage + 1))}
                className={currentPage >= data.totalPages ? 'opacity-50 pointer-events-none' : ''}
              >
                <Button variant="ridge" size="sm">
                  Next
                </Button>
              </Link>
            </div>
          </div>
        </RidgeCard>
      )}
    </>
  );
}

export default function VendorProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 bg-surface-canvas min-h-screen">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[var(--accent)]/10">
            <Package className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="folio-h1">
              Products
            </h1>
            <p className="folio-body text-folio-text-secondary">
              Manage your product catalog
            </p>
          </div>
        </div>

        <Link href="/vendor/products/new">
          <Button variant="accent" size="lg">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* Filters and Table */}
      <Suspense
        fallback={
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-surface-ground rounded-lg" />
            <div className="h-64 bg-surface-ground rounded-xl" />
          </div>
        }
      >
        <ProductsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
