'use client';

import { FaEye, FaBookmark, FaCalendarAlt, FaTrophy } from 'react-icons/fa';

interface Product {
  product_id: string;
  product_name: string;
  saves_total: number;
}

interface VendorOverviewCardProps {
  totalViews: number;
  totalSaves: number;
  eventsFeatured: number;
  topProducts: Product[];
}

export default function VendorOverviewCard({
  totalViews,
  totalSaves,
  eventsFeatured,
  topProducts
}: VendorOverviewCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Views */}
        <div className="bg-blue-50 rounded-lg p-5">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <FaEye className="text-xl" />
            <h3 className="font-semibold mb-1">Total Views</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalViews.toLocaleString()}</p>
        </div>

        {/* Total Saves */}
        <div className="bg-green-50 rounded-lg p-5">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <FaBookmark className="text-xl" />
            <h3 className="font-semibold mb-1">Total Saves</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalSaves.toLocaleString()}</p>
        </div>

        {/* Events Featured */}
        <div className="bg-purple-50 rounded-lg p-5">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <FaCalendarAlt className="text-xl" />
            <h3 className="font-semibold mb-1">Events Featured</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{eventsFeatured}</p>
        </div>

        {/* Top Products */}
        <div className="bg-amber-50 rounded-lg p-5">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <FaTrophy className="text-xl" />
            <h3 className="font-semibold">Top Products</h3>
          </div>
          <div className="space-y-2 pt-2">
            {topProducts.map((product, index) => (
              <div key={product.product_id} className="flex items-center justify-between">
                <span className="text-base truncate text-gray-900">{product.product_name}</span>
                <span className="text-base font-semibold text-gray-900">{product.saves_total} saves</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 