'use client';

import Link from 'next/link';

interface Product {
  product_id: string;
  product_name: string;
  views_total: number;
  saves_total: number;
  designers_saved: number;
  events_featured: string[];
  outbound_clicks: number;
  save_velocity_7d: number[];
  saved_together: string[];
}

interface ProductAnalyticsTableProps {
  products: Product[];
}

export default function ProductAnalyticsTable({ products }: ProductAnalyticsTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--ridge-outer)]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Product Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Views
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Saves
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Designers Saved
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Events Featured
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Outbound Clicks
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Save Velocity (7d)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Saved Together
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--ridge-outer)]">
            {products.map((product) => (
              <tr key={product.product_id} className="hover:bg-surface-ground">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/vendor/product/${product.product_id}`}>
                    <div className="text-sm font-medium text-[var(--accent)] hover:underline cursor-pointer">{product.product_name}</div>
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-folio-text-primary">{product.views_total.toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-folio-text-primary">{product.saves_total.toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-folio-text-primary">{product.designers_saved}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-folio-text-primary">
                    {product.events_featured.join(', ')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-folio-text-primary">{product.outbound_clicks.toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-folio-text-primary">{product.save_velocity_7d.join(', ')}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-folio-text-primary">
                    {product.saved_together.join(', ')}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 