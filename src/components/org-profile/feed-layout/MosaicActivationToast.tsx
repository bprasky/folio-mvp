'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FEED_LAYOUT_THRESHOLDS } from '@/lib/feed/feed-layout';

interface MosaicActivationToastProps {
  orgId: string;
  projectCount: number;
  isMember: boolean;
}

export default function MosaicActivationToast({
  orgId,
  projectCount,
  isMember,
}: MosaicActivationToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isMember || projectCount < FEED_LAYOUT_THRESHOLDS.mosaic) return;

    const key = `folio:mosaic-activated:${orgId}`;
    const alreadyShown = localStorage.getItem(key);

    if (!alreadyShown) {
      setShow(true);
      localStorage.setItem(key, 'true');
      const t = setTimeout(() => setShow(false), 4000);
      return () => clearTimeout(t);
    }
  }, [orgId, projectCount, isMember]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute top-0 left-0 right-0 z-10 flex justify-center
                     pointer-events-none mb-4"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
        >
          <div className="bg-stone-900 text-white text-xs px-4 py-2.5 rounded-full
                          shadow-lg pointer-events-auto">
            Your feed just got its full layout.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
