'use client';

import Image from 'next/image';
import { FaEye, FaBookmark, FaCalendarAlt, FaMousePointer, FaRocket } from 'react-icons/fa';

interface ProductInsightsHeaderProps {
  productName: string;
  productImage: string;
  totalViews: number;
  totalSaves: number;
  eventsFeatured: string[];
  outboundClicks: number;
  onBoostClick: () => void;
}

export default function ProductInsightsHeader({
  productName,
  productImage,
  totalViews,
  totalSaves,
  eventsFeatured,
  outboundClicks,
  onBoostClick,
}: ProductInsightsHeaderProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
        <div className="relative w-32 h-32 md:w-48 md:h-48 flex-shrink-0">
          <Image
            src={productImage}
            alt={productName}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover rounded-lg shadow"
          />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{productName}</h1>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="flex items-center gap-2 text-blue-600">
              <FaEye /> <span className="font-medium">{totalViews.toLocaleString()} Views</span>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <FaBookmark /> <span className="font-medium">{totalSaves.toLocaleString()} Saves</span>
            </div>
            <div className="flex items-center gap-2 text-purple-600">
              <FaCalendarAlt /> <span className="font-medium">{eventsFeatured.length} Events</span>
            </div>
            <div className="flex items-center gap-2 text-amber-600">
              <FaMousePointer /> <span className="font-medium">{outboundClicks.toLocaleString()} Clicks</span>
            </div>
          </div>
          <p className="text-gray-600 mb-4">
            Featured in: {eventsFeatured.length > 0 ? eventsFeatured.join(', ') : 'None'}
          </p>
          <button
            onClick={onBoostClick}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-md shadow-lg hover:from-blue-600 hover:to-indigo-700 transition flex items-center justify-center mx-auto md:mx-0"
          >
            <FaRocket className="mr-2" /> Boost This Product
          </button>
        </div>
      </div>
    </div>
  );
} 