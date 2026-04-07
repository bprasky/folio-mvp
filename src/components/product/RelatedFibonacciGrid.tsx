"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

interface RelatedProduct {
  id: string;
  slug: string;
  name: string;
  thumb: string;
}

interface RelatedFibonacciGridProps {
  items: RelatedProduct[];
}

export function RelatedFibonacciGrid({ items }: RelatedFibonacciGridProps) {
  return (
    <section className="py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <h2 className="text-2xl lg:text-3xl font-serif font-light text-folio-text-primary dark:text-folio-text-tertiary">
          Related products
        </h2>
        <p className="mt-2 text-sm text-folio-text-secondary dark:text-folio-text-tertiary">
          From the same collection or similar materials
        </p>
      </motion.div>

      {/* Fibonacci-inspired asymmetric grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 lg:gap-6 auto-rows-[200px]">
        {items.map((item, index) => (
          <RelatedCard 
            key={item.id} 
            item={item} 
            index={index}
            // Fibonacci pattern: first item spans 2x2, alternating sizes
            className={getFibonacciSpan(index)}
          />
        ))}
      </div>
    </section>
  );
}

function getFibonacciSpan(index: number): string {
  const patterns = [
    "col-span-2 md:col-span-4 row-span-2", // Large hero
    "col-span-1 md:col-span-2 row-span-1", // Small
    "col-span-1 md:col-span-2 row-span-1", // Small
    "col-span-2 md:col-span-3 row-span-2", // Medium-large
    "col-span-2 md:col-span-3 row-span-1", // Medium
  ];
  return patterns[index % patterns.length];
}

function RelatedCard({ 
  item, 
  index, 
  className 
}: { 
  item: RelatedProduct; 
  index: number;
  className: string;
}) {
  const prefersReducedMotion = typeof window !== "undefined" 
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches 
    : false;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ 
        duration: prefersReducedMotion ? 0 : 0.16, 
        delay: prefersReducedMotion ? 0 : index * 0.06,
        ease: [0.2, 0.8, 0.2, 1]
      }}
      className={className}
    >
      <Link 
        href={`/products/${item.slug}`}
        className="group relative block w-full h-full overflow-hidden rounded-2xl bg-surface-elevated dark:bg-surface-elevated"
      >
        {/* Image */}
        <div className="relative w-full h-full">
          <Image
            src={item.thumb}
            alt={item.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Title - Always visible on mobile, hover on desktop */}
        <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
          <div className="transform translate-y-2 md:translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <h3 className="text-base md:text-lg font-medium text-white drop-shadow-lg">
              {item.name}
            </h3>
            <div className="mt-2 flex items-center gap-2 text-sm text-white/90 opacity-0 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span>View Product</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Focus Ring */}
        <div className="absolute inset-0 ring-2 ring-transparent group-focus-visible:ring-stone-400 rounded-2xl transition-all" />
      </Link>
    </motion.div>
  );
}

