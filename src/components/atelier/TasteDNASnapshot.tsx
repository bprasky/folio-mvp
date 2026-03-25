"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface TasteDNASnapshotProps {
  descriptors?: string[];
}

const defaultDescriptors = [
  'Warm Neutrals',
  'Textural Contrast',
  'Organic Forms',
  'Timeless Elegance',
  'Curated Minimalism',
];

export default function TasteDNASnapshot({ descriptors }: TasteDNASnapshotProps) {
  const displayDescriptors = descriptors && descriptors.length > 0 
    ? descriptors 
    : defaultDescriptors;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mb-12"
    >
      <h2 className="text-2xl font-serif text-folio-ink mb-6">Taste DNA Snapshot</h2>
      
      <div className="flex flex-wrap gap-3">
        {displayDescriptors.map((descriptor, index) => (
          <motion.span
            key={descriptor}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="px-4 py-2 glass-surface rounded-full text-sm font-sans text-folio-ink hover:border-folio-accent-200 hover:bg-folio-accent-200/20 transition-all duration-300"
          >
            {descriptor}
          </motion.span>
        ))}
      </div>

      {(!descriptors || descriptors.length === 0) && (
        <p className="mt-4 text-xs text-folio-stone-400 font-sans italic">
          Default style descriptors. Complete projects to generate personalized taste profile.
        </p>
      )}
    </motion.div>
  );
}
