"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import SafeImage from "@/components/SafeImage";
import { FeaturedProduct } from "@/lib/events";

interface FeaturedProductsProps {
  products?: FeaturedProduct[];
  eventId?: string;
  eventTitle?: string;
}

export default function FeaturedProducts({ 
  products: propProducts, 
  eventId, 
  eventTitle 
}: FeaturedProductsProps) {
  const { data: session } = useSession();
  const [savingProduct, setSavingProduct] = useState<string | null>(null);
  const [products, setProducts] = useState<FeaturedProduct[] | null>(null);
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
    fetch(`/api/events/${eventId}/featured-products`)
      .then(res => res.json())
      .then(data => {
        setProducts(data.products || []);
      })
      .catch(error => {
        console.error("Error fetching featured products:", error);
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

  // Loading state - show skeleton tiles
  if (loading || products === null) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl bg-white/60 backdrop-blur-md border border-white/20 shadow-sm animate-pulse"
          >
            <div className="h-32 bg-gray-200 rounded-t-xl"></div>
            <div className="p-3">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
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
        <p className="text-sm text-neutral-500">No featured products yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <div
          key={product.id}
          className="group rounded-xl bg-white/60 backdrop-blur-md border border-white/20 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => handleProductClick(product.id)}
        >
          {/* Product Image */}
          <div className="relative h-32 bg-gray-100">
            <SafeImage
              src={product.imageUrl || "/images/product-placeholder.jpg"}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            
            {/* Vendor Badge */}
            <div className="absolute top-2 left-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-700">
                {product.vendor?.companyName || product.vendor?.name || "Vendor"}
              </span>
            </div>

            {/* Save Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSaveToProject(product.id);
              }}
              disabled={savingProduct === product.id}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-50"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          </div>

          {/* Product Info */}
          <div className="p-3">
            <h3 className="line-clamp-2 text-sm font-medium text-gray-900 mb-1">
              {product.name}
            </h3>
            
            {product.vendor?.name && (
              <p className="text-xs text-neutral-500 line-clamp-1">
                {product.vendor.name}
              </p>
            )}

            {product.price && (
              <div className="mt-2">
                <span className="text-sm font-semibold text-blue-600">
                  ${product.price.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
} 