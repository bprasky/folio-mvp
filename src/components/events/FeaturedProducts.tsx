"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FeaturedProductCard } from "./FeaturedProductCard";
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
            className="rounded-xl bg-surface-canvas/60 backdrop-blur-md border border-folio-border-subtle shadow-sm animate-pulse"
          >
            <div className="h-32 bg-surface-ground rounded-t-xl"></div>
            <div className="p-3">
              <div className="h-4 bg-surface-ground rounded mb-2"></div>
              <div className="h-3 bg-surface-ground rounded w-2/3"></div>
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
        <p className="text-sm text-folio-text-secondary">No featured products yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <FeaturedProductCard
          key={product.id}
          product={product}
          user={session?.user}
          eventId={eventId}
          onProductClick={handleProductClick}
          onSaveToProject={handleSaveToProject}
          savingProduct={savingProduct}
        />
      ))}
    </div>
  );
} 