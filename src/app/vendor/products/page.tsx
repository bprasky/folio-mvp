import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Package } from 'lucide-react';
import { listVendors, listVendorProducts } from './actions';
import ProductsFilters from '@/components/vendor/products/ProductsFilters';
import { ProductThumbnail } from '@/components/vendor/products/ProductThumbnail';

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
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-12 text-center">
          <p className="text-stone-600 dark:text-stone-400 mb-4">No products found</p>
          <Link
            href="/vendor/products/new"
            className="inline-block rounded-full bg-stone-900 dark:bg-stone-100 px-6 py-2 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors"
          >
            + Add Your First Product
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-b border-stone-200 dark:border-stone-700">
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
                    className="border-t border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
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
                        <span className="text-stone-900 dark:text-stone-100 font-medium">
                          {product.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-stone-600 dark:text-stone-400">
                      {product.skuOrBrand}
                    </td>
                    <td className="px-4 py-3 text-stone-600 dark:text-stone-400">
                      {product.vendorName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          product.status === 'PUBLISHED'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600 dark:text-stone-400">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/vendor/products/${product.id}`}
                        className="inline-flex items-center gap-2 rounded-md border border-stone-300 dark:border-stone-700 px-3 py-1 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-xs"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200 dark:border-stone-700 text-sm">
            <span className="text-stone-600 dark:text-stone-400">
              {(currentPage - 1) * data.pageSize + 1}–
              {Math.min(currentPage * data.pageSize, data.total)} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={buildUrl(Math.max(1, currentPage - 1))}
                className={`rounded-md border border-stone-300 dark:border-stone-700 px-3 py-1 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors ${
                  currentPage === 1 ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                Previous
              </Link>
              <span className="text-stone-600 dark:text-stone-400">
                Page {currentPage} of {data.totalPages}
              </span>
              <Link
                href={buildUrl(Math.min(data.totalPages, currentPage + 1))}
                className={`rounded-md border border-stone-300 dark:border-stone-700 px-3 py-1 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors ${
                  currentPage >= data.totalPages ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        </div>
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
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900">
            <Package className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-light text-stone-900 dark:text-stone-100">
              Products
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Manage your product catalog
            </p>
          </div>
        </div>
        
        <Link
          href="/vendor/products/new"
          className="inline-flex items-center gap-2 rounded-full bg-stone-900 dark:bg-stone-100 px-6 py-2.5 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      {/* Filters and Table */}
      <Suspense
        fallback={
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-stone-200 dark:bg-stone-800 rounded-lg" />
            <div className="h-64 bg-stone-200 dark:bg-stone-800 rounded-xl" />
          </div>
        }
      >
        <ProductsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
