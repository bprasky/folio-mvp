"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from '@/components/FolioImage';
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
        <h2 className="text-2xl lg:text-3xl font-headline font-light text-stone-900 dark:text-stone-100">
          Related products
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
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
        className="group relative flex flex-col w-full h-full overflow-hidden rounded-2xl bg-stone-200 dark:bg-stone-800"
      >
        {/* Photo — unobstructed */}
        <div className="relative flex-1 min-h-0">
          <Image
            src={item.thumb}
            alt={item.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>

        {/* Info container below photo */}
        <div className="flex items-center justify-between bg-surface-ground p-3">
          <h3 className="text-sm font-medium text-folio-text-primary truncate">
            {item.name}
          </h3>
          <ArrowRight className="w-4 h-4 text-folio-text-secondary flex-shrink-0 ml-2 group-hover:translate-x-1 transition-transform" />
        </div>

        {/* Focus Ring */}
        <div className="absolute inset-0 ring-2 ring-transparent group-focus-visible:ring-stone-400 rounded-2xl transition-all" />
      </Link>
    </motion.div>
  );
}
