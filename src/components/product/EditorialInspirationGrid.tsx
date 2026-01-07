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
  return (
    <section className="py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <h2 className="text-2xl lg:text-3xl font-serif font-light text-stone-900 dark:text-stone-100">
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
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-stone-200 dark:bg-stone-800">
        {/* Image */}
        <div className="relative w-full h-full">
          <Image
            src={item.src}
            alt={`${item.room} by ${item.by}`}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

        {/* Info Overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.12 + index * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-2"
          >
            {/* Room Tag */}
            <div className="inline-block px-2 py-1 rounded-md bg-white/20 backdrop-blur-sm">
              <span className="text-xs font-medium text-white">
                {item.room}
              </span>
            </div>

            {/* Bottom Info */}
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-1.5 text-sm">
                <User className="w-3.5 h-3.5 opacity-80" />
                <span className="font-medium">{item.by}</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span className="font-medium">{item.likes}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

