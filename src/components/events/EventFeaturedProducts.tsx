"use client";
import React from "react";
import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { track } from "@/lib/analytics";

type UIProduct = {
  id: string;
  name: string;
  imageUrl?: string;
  vendorName?: string;
};

type Props = {
  products: UIProduct[];
  canEdit?: boolean;             // admin flag from parent
  eventId: string;               // for admin CTA link
  onSaveProduct?: (id: string) => void; // optional hook (no-op if missing)
};

export default function EventFeaturedProducts({ products, canEdit = false, eventId, onSaveProduct }: Props) {
  // Track impression when component mounts with products
  React.useEffect(() => {
    if (products.length > 0) {
      track('event_featured_products_impression', { eventId, count: products.length });
    }
  }, [products.length, eventId]);

  // If no products and not admin, hide completely
  if (products.length === 0 && !canEdit) {
    return null;
  }

  // If no products but admin, show add products CTA
  if (products.length === 0 && canEdit) {
    return (
      <div className="mt-6">
        <div className="border border-dashed border-gray-300 rounded-xl bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-500 mb-2">No featured products yet</p>
          <Link
            href={`/admin/events/new?edit=${eventId}&tab=products`}
            className="text-xs px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
          >
            Add featured products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Featured Products</h3>
        {canEdit && (
          <Link
            href={`/admin/events/new?edit=${eventId}&tab=products`}
            className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
          >
            Edit
          </Link>
        )}
      </div>
      
      <div className="flex gap-3 overflow-x-auto py-2">
        {products.map((product) => (
          <div
            key={product.id}
            className="relative w-56 shrink-0 rounded-xl border border-folio-border bg-white hover:shadow-sm transition-shadow"
          >
            <div className="aspect-[4/3] w-full overflow-hidden rounded-t-xl">
              {product.imageUrl ? (
                <SafeImage
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="224px"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400 text-sm">No image</span>
                </div>
              )}
            </div>
            
            <div className="p-2">
              <h4 className="font-medium text-sm truncate mb-1">{product.name}</h4>
              {product.vendorName && (
                <p className="text-xs text-gray-500 truncate mb-2">{product.vendorName}</p>
              )}
              
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    track('event_featured_product_save', { eventId, productId: product.id });
                    onSaveProduct?.(product.id);
                  }}
                  disabled={!onSaveProduct}
                  className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save to project
                </button>
                
                <Link
                  href={`/products/${product.id}`}
                  onClick={() => track('event_featured_product_click', { eventId, productId: product.id })}
                  className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-center"
                >
                  View
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 