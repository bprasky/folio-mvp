"use client";

import React, { useState, useEffect } from 'react';
import Image from '@/components/FolioImage';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface Product {
  id: string;
  name: string;
  vendor?: string;
  imageUrl?: string | null;
  thumbnail?: string | null;
}

interface KnownForProductsProps {
  products: Product[];
}

export default function KnownForProducts({ products }: KnownForProductsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);

  // Show up to 5 products at a time on desktop, 3 on tablet, 1 on mobile
  useEffect(() => {
    const itemsToShow = typeof window !== 'undefined' 
      ? window.innerWidth >= 1024 ? 5 : window.innerWidth >= 768 ? 3 : 1
      : 5;
    
    const start = currentIndex;
    const end = Math.min(start + itemsToShow, products.length);
    setVisibleProducts(products.slice(start, end));
  }, [currentIndex, products]);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(1, products.length - 4));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + products.length - 4) % Math.max(1, products.length - 4));
  };

  if (!products || products.length === 0) {
    return (
      <div className="mb-12">
        <h2 className="text-2xl font-serif text-folio-ink mb-6">Known For Products</h2>
        <div className="glass-surface rounded-xl p-8 text-center">
          <p className="text-folio-stone-400 font-sans">No products tagged yet. Start tagging products in your projects to build your product portfolio.</p>
        </div>
      </div>
    );
  }

  const canGoNext = products.length > 5;
  const canGoPrev = currentIndex > 0;

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif text-folio-ink">Known For Products</h2>
        {products.length > 5 && (
          <div className="flex gap-2">
            <button
              onClick={prevSlide}
              disabled={!canGoPrev}
              className={`p-2 rounded-lg border transition-colors ${
                canGoPrev
                  ? 'border-folio-stone-300 text-folio-ink hover:bg-folio-stone-100'
                  : 'border-folio-stone-100 text-folio-stone-300 cursor-not-allowed'
              }`}
            >
              <FaChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextSlide}
              disabled={!canGoNext}
              className={`p-2 rounded-lg border transition-colors ${
                canGoNext
                  ? 'border-folio-stone-300 text-folio-ink hover:bg-folio-stone-100'
                  : 'border-folio-stone-100 text-folio-stone-300 cursor-not-allowed'
              }`}
            >
              <FaChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <AnimatePresence mode="wait">
            {visibleProducts.map((product, index) => (
              <motion.div
                key={`${product.id}-${currentIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="glass-surface rounded-xl overflow-hidden hover:shadow-folio1 transition-all duration-300 group"
              >
                <div className="relative aspect-square bg-folio-stone-100">
                  {product.imageUrl || product.thumbnail ? (
                    <Image
                      src={product.imageUrl || product.thumbnail || '/images/product-placeholder.jpg'}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-folio-stone-300">
                      <span className="text-xs">No Image</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-sans font-medium text-folio-ink text-sm mb-1 line-clamp-2">
                    {product.name}
                  </h3>
                  {product.vendor && (
                    <p className="text-xs text-folio-stone-400 font-sans">{product.vendor}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
