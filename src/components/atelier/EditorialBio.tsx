"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface EditorialBioProps {
  name: string;
  bio?: string | null;
  title?: string | null;
}

export default function EditorialBio({ name, bio, title }: EditorialBioProps) {
  const displayBio = bio || "Complete your designer interview to share your story, design philosophy, and what makes your work unique. Your bio will help clients connect with your vision and approach.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mb-12"
    >
      <h1 className="text-4xl md:text-5xl font-serif text-folio-ink mb-4 leading-tight tracking-tight">
        {name}
      </h1>
      {title && (
        <p className="text-lg text-folio-accent-400 mb-6 font-sans">{title}</p>
      )}
      <div className="prose prose-lg max-w-none">
        <p className="text-base md:text-lg text-folio-stone-600 leading-relaxed font-sans">
          {displayBio}
        </p>
      </div>
      
      {!bio && (
        <div className="mt-6 p-4 bg-folio-accent-200/30 border border-folio-accent-200/50 rounded-xl">
          <p className="text-sm text-folio-accent-700 font-sans">
            💡 <strong>Tip:</strong> Complete your designer interview to personalize your profile and attract the right clients.
          </p>
        </div>
      )}
    </motion.div>
  );
}
