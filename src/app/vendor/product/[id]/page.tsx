'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ProductInsightsHeader from '@/components/vendor/product/ProductInsightsHeader';
import DesignerEngagementLeaderboard from '@/components/vendor/product/DesignerEngagementLeaderboard';
import SaveVelocityGraph from '@/components/vendor/product/SaveVelocityGraph';
import SavedTogetherPanel from '@/components/vendor/product/SavedTogetherPanel';
import BoostProductModal from '@/components/vendor/product/BoostProductModal';

interface DesignerEngagement {
  designer_name: string;
  profile_image: string;
  total_saves: number;
  total_views: number;
  featured_in_events: string[];
}

interface DetailedProduct {
  product_id: string;
  product_name: string;
  views_total: number;
  saves_total: number;
  designers_saved: number;
  events_featured: string[];
  outbound_clicks: number;
  save_velocity_7d: number[];
  saved_together: string[];
  new_designers_30d: number;
  designers_engagement: DesignerEngagement[];
}

export default function ProductInsightsPage() {
  const params = useParams();
  const id = params?.id as string; // Assert id as string
  const [productData, setProductData] = useState<DetailedProduct | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchProductData() {
      try {
        const response = await fetch('/vendor_analytics.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const product = data.detailed_products.find((p: DetailedProduct) => p.product_id === id);
        setProductData(product || null);
      } catch (error) {
        console.error("Error fetching product data:", error);
        setProductData(null);
      }
    }

    if (id) {
      fetchProductData();
    }
  }, [id]);

  const handleBoostProduct = (designerName: string) => {
    // In MVP, this is just a placeholder. In a real app, you'd send data to a backend.
    console.log(`Product boosted with designer: ${designerName}`);
    alert(`Product boosted with ${designerName}! (Functionality not implemented in MVP)`);
  };

  if (!productData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-700">Loading product insights or product not found...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <ProductInsightsHeader
          productName={productData.product_name}
          productImage="https://source.unsplash.com/random/1200x800?product,insights,dashboard" // Placeholder image
          totalViews={productData.views_total}
          totalSaves={productData.saves_total}
          eventsFeatured={productData.events_featured}
          outboundClicks={productData.outbound_clicks}
          onBoostClick={() => setIsModalOpen(true)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <DesignerEngagementLeaderboard designers={productData.designers_engagement} />
          <div>
            <SaveVelocityGraph data={productData.save_velocity_7d} />
            <SavedTogetherPanel products={productData.saved_together} />
          </div>
        </div>

        <BoostProductModal
          designers={productData.designers_engagement.map(d => ({ designer_name: d.designer_name }))}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirmBoost={handleBoostProduct}
        />
      </div>
    </div>
  );
} 