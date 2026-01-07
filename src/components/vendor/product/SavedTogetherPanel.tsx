'use client';

import { FaLink } from 'react-icons/fa';

interface SavedTogetherPanelProps {
  products: string[]; // Array of product names saved together
}

export default function SavedTogetherPanel({ products }: SavedTogetherPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
        <FaLink className="text-purple-500 mr-3" /> Saved Together
      </h2>
      <div className="space-y-3">
        {products.length > 0 ? (
          products.map((productName, index) => (
            <div key={index} className="flex items-center p-3 bg-gray-50 rounded-md shadow-sm">
              <span className="text-gray-900">{productName}</span>
            </div>
          ))
        ) : (
          <p className="text-gray-600">No products frequently saved together.</p>
        )}
      </div>
    </div>
  );
} 