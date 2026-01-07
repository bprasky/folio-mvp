'use client';

import { FaFire } from 'react-icons/fa';
import Link from 'next/link';

interface Product {
  product_id: string;
  product_name: string;
  saves_total: number;
  saves_last_7_days: number;
}

interface TopSavedProductsLeaderboardProps {
  products: Product[];
}

export default function TopSavedProductsLeaderboard({ products }: TopSavedProductsLeaderboardProps) {
  const sortedProducts = [...products].sort((a, b) => b.saves_total - a.saves_total).slice(0, 3);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Top Saved Products</h2>
      <div className="space-y-4">
        {sortedProducts.map((product, index) => {
          const isHot = product.saves_last_7_days > (product.saves_total * 0.20);
          return (
            <div key={product.product_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
              <div className="flex items-center">
                <span className="text-lg font-bold text-gray-700 mr-4">#{index + 1}</span>
                <Link 
                  href={product.product_name === 'Eco Modular Sofa' ? '/product/eco-modular-sofa' : `#/product/${product.product_id}`}
                  className="text-lg text-gray-900 hover:underline"
                >
                  {product.product_name}
                </Link>
              </div>
              <div className="flex items-center">
                <span className="text-lg font-semibold text-gray-700">{product.saves_total.toLocaleString()} Saves</span>
                {isHot && <FaFire className="ml-2 text-amber-500" title="Hot product! More than 20% saves in last 7 days" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 