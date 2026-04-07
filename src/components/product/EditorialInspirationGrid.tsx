"use client";

import React from "react";
import { motion } from "framer-motion";
import { TaggedImage } from "@/lib/mock/product";
import { Heart, User } from "lucide-react";
import Image from "next/image";

interface EditorialInspirationGridProps {
  items: TaggedImage[];
}

export function EditorialInspirationGrid({ items }: EditorialInspirationGridProps) {
  if (items.length === 0) return null;

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
          Inspiration using this product
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          Most-liked affiliate-tagged images from the Folio community
        </p>
      </motion.div>

      {/* Staggered Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {items.map((item, index) => (
          <EditorialCard
            key={item.id}
            item={item}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}

function EditorialCard({ item, index }: { item: TaggedImage; index: number }) {
  const prefersReducedMotion = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.16,
        delay: prefersReducedMotion ? 0 : index * 0.06,
        ease: [0.2, 0.8, 0.2, 1]
      }}
      whileHover={prefersReducedMotion ? {} : { y: -4 }}
      className="group relative cursor-pointer"
    >
      {/* Photo — unobstructed */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-2xl bg-stone-200 dark:bg-stone-800">
        <div className="relative w-full h-full">
          <Image
            src={item.src}
            alt={`${item.room} by ${item.by}`}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        </div>
      </div>

      {/* Info container below photo */}
      <div className="rounded-b-2xl bg-surface-ground p-3 space-y-2">
        {/* Room Tag */}
        <div className="inline-block px-2 py-1 rounded-md bg-stone-200/60 dark:bg-stone-700/60">
          <span className="text-xs font-medium text-folio-text-primary">
            {item.room}
          </span>
        </div>

        {/* Designer + Likes */}
        <div className="flex items-center justify-between text-folio-text-secondary">
          <div className="flex items-center gap-1.5 text-sm">
            <User className="w-3.5 h-3.5 opacity-80" />
            <span className="font-medium">{item.by}</span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <Heart className="w-3.5 h-3.5" />
            <span className="font-medium">{item.likes}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
