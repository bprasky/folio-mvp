"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import SafeImage from "@/components/SafeImage";
import { TrendingProduct } from "@/lib/events";

interface BreakoutPanelProps {
  products?: TrendingProduct[];
  eventId?: string;
  eventTitle?: string;
}

export default function BreakoutPanel({ 
  products: propProducts, 
  eventId, 
  eventTitle 
}: BreakoutPanelProps) {
  const { data: session } = useSession();
  const [savingProduct, setSavingProduct] = useState<string | null>(null);
  const [products, setProducts] = useState<TrendingProduct[] | null>(null);
  const [loading, setLoading] = useState(false);

  // If products are passed as props, use them; otherwise fetch by eventId
  useEffect(() => {
    if (propProducts !== undefined) {
      setProducts(propProducts);
      return;
    }

    if (!eventId) {
      setProducts([]);
      return;
    }

    setLoading(true);
    fetch(`/api/events/${eventId}/trending-products`)
      .then(res => res.json())
      .then(data => {
        setProducts(data.products || []);
      })
      .catch(error => {
        console.error("Error fetching trending products:", error);
        setProducts([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [propProducts, eventId]);

  const handleProductClick = async (productId: string) => {
    // Track product view
    try {
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verb: "VIEW_PRODUCT",
          eventId,
          productId,
        }),
      });
    } catch (error) {
      console.error("Error tracking product view:", error);
    }
  };

  const handleSaveToProject = async (productId: string) => {
    if (!session?.user?.id) {
      // Trigger auth flow
      return;
    }

    setSavingProduct(productId);
    try {
      const response = await fetch(`/api/products/${productId}/save-to-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          newProjectName: `From ${eventTitle}`,
        }),
      });

      if (response.ok) {
        // Show success toast or update UI
        console.log("Product saved successfully");
      }
    } catch (error) {
      console.error("Error saving product:", error);
    } finally {
      setSavingProduct(null);
    }
  };

  // Loading state
  if (loading || products === null) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="flex items-center space-x-3 p-3">
              <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (!products || products.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-neutral-500">No trending products yet.</p>
      </div>
    );
  }

  const spikingProducts = products.filter(p => p.isSpiking);

  return (
    <div className="space-y-4">
      {products.slice(0, 4).map((product) => (
        <div
          key={product.id}
          className="group flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={() => handleProductClick(product.id)}
        >
          {/* Product Image */}
          <div className="relative flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
            <SafeImage
              src={product.imageUrl || "/images/product-placeholder.jpg"}
              alt={product.name}
              fill
              className="object-cover"
              sizes="64px"
            />
            
            {/* Spiking indicator */}
            {product.isSpiking && (
              <div className="absolute top-1 right-1">
                <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 mb-1 line-clamp-1">
              {product.name}
            </h4>
            
            {product.vendor?.name && (
              <p className="text-xs text-gray-500 mb-1 line-clamp-1">
                {product.vendor.name}
              </p>
            )}

            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>{product.views} views</span>
              <span>•</span>
              <span>{product.saves} saves</span>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSaveToProject(product.id);
            }}
            disabled={savingProduct === product.id}
            className="flex-shrink-0 p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
} 