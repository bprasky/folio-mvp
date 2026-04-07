'use client';
import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface LogoDriftAnimationProps {
  isVisible: boolean;
  onComplete: () => void;
}

export default function LogoDriftAnimation({ isVisible, onComplete }: LogoDriftAnimationProps) {
  const controls = useAnimation();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      
      // Start the animation sequence
      controls.start({
        x: [0, 0, 0],
        y: [0, -100, -200],
        scale: [1, 0.8, 0.6],
        opacity: [1, 1, 0],
        transition: {
          duration: 2,
          times: [0, 0.7, 1],
          ease: "easeInOut"
        }
      }).then(() => {
        setIsAnimating(false);
        onComplete();
      });
    }
  }, [isVisible, controls, onComplete]);

  if (!isVisible && !isAnimating) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 z-50 pointer-events-none"
      animate={controls}
      initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
    >
      <div className="text-4xl font-serif text-folio-text-primary tracking-wider">
        FOLIO
      </div>
    </motion.div>
  );
}





