'use client';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface MagazineLoadingAnimationProps {
  onComplete: () => void;
  duration?: number;
}

export default function MagazineLoadingAnimation({ 
  onComplete, 
  duration = 3000 
}: MagazineLoadingAnimationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // Allow fade out to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.5, delay: duration - 500 }}
      className="fixed inset-0 z-50 bg-surface-elevated flex items-center justify-center"
    >
      {/* Magazine Cover Simulation */}
      <div className="text-center">
        {/* Magazine Title */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <h1 className="text-6xl font-serif text-folio-text-primary mb-2 tracking-wider">
            FOLIO
          </h1>
          <div className="w-24 h-0.5 bg-stone-600 mx-auto"></div>
          <div className="text-sm text-folio-text-secondary mt-2 tracking-widest uppercase">
            Design Magazine
          </div>
        </motion.div>

        {/* Magazine Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8"
        >
          <div className="text-2xl font-serif text-folio-text-secondary mb-2">
            DESIGN INTELLIGENCE
          </div>
          <div className="text-lg text-folio-text-secondary max-w-md mx-auto">
            Where architecture meets innovation, and design meets data.
          </div>
        </motion.div>

        {/* Loading Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-folio-text-secondary text-lg mb-6"
        >
          Opening your design magazine...
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.5, delay: 0.8 }}
          className="h-0.5 bg-stone-400 mx-auto max-w-xs"
        />

        {/* Magazine Elements */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute inset-0 pointer-events-none"
        >
          <div className="absolute top-20 left-20 w-32 h-32 border border-folio-border-strong rotate-12" />
          <div className="absolute top-40 right-32 w-24 h-24 border border-folio-border-strong rotate-45" />
          <div className="absolute bottom-32 left-32 w-40 h-40 border border-folio-border-strong rotate-12" />
          <div className="absolute bottom-20 right-20 w-28 h-28 border border-folio-border-strong rotate-45" />
        </motion.div>
      </div>
    </motion.div>
  );
}





