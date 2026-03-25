"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { FaFingerprint } from 'react-icons/fa';

interface FolioFingerprintProps {
  descriptors?: string[];
}

const defaultDescriptors = [
  'Warm Neutrals',
  'Textural Contrast',
  'Organic Forms',
  'Timeless Elegance',
  'Curated Minimalism',
];

export default function FolioFingerprint({ descriptors }: FolioFingerprintProps) {
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
      <div className="glass-surface rounded-2xl p-8 shadow-folio1">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-folio-accent-200/30 rounded-xl flex items-center justify-center text-folio-accent-700">
            <FaFingerprint className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-serif text-folio-ink">Folio Fingerprint</h2>
        </div>
        
        <p className="text-folio-stone-600 font-sans mb-6 leading-relaxed">
          A visual signature of stylistic identity, distilled from the essence of their work.
        </p>

        <div className="flex flex-wrap gap-3">
          {displayDescriptors.map((descriptor, index) => (
            <motion.span
              key={descriptor}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="px-4 py-2 bg-folio-accent-200/20 border border-folio-accent-200/50 rounded-full text-sm font-sans text-folio-accent-700 hover:border-folio-accent-400 hover:bg-folio-accent-200/30 transition-all duration-300"
            >
              {descriptor}
            </motion.span>
          ))}
        </div>

        {(!descriptors || descriptors.length === 0) && (
          <p className="mt-4 text-xs text-folio-stone-400 font-sans italic">
            Default style descriptors. Complete projects to generate personalized fingerprint.
          </p>
        )}
      </div>
    </motion.div>
  );
}
