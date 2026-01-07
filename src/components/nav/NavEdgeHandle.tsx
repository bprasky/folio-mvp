'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';

interface NavEdgeHandleProps {
  onOpen: () => void;
  onClose: () => void;
  isOpen: boolean;
  ariaControls?: string;
}

export default function NavEdgeHandle({
  onOpen,
  onClose,
  isOpen,
  ariaControls,
}: NavEdgeHandleProps) {
  const handleMouseEnter = () => {
    onOpen();
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    // Only close if mouse is moving AWAY from the rail area
    // If moving toward the rail (x > 12), don't close
    if (e.clientX <= 12) {
      onClose();
    }
  };

  return (
    <motion.button
      aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
      aria-expanded={isOpen}
      aria-controls={ariaControls}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={onOpen}
      onBlur={onClose}
      onClick={() => (isOpen ? onClose() : onOpen())}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={clsx(
        'fixed left-0 top-0 z-[60] h-screen outline-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
      )}
      style={{ width: 24, touchAction: 'manipulation' }} // Expanded from 12px to 24px for easier hover
    >
      <span className="sr-only">Navigation handle</span>
      <motion.span
        className={clsx(
          'absolute left-0 top-1/2 -translate-y-1/2 h-24 rounded-full',
          'bg-gradient-to-b from-white/20 via-white/60 to-white/20'
        )}
        style={{ width: isOpen ? 3 : 2 }}
        animate={{
          opacity: isOpen ? 0.8 : 0.4,
          width: isOpen ? 3 : 2,
        }}
        transition={{ duration: 0.2 }}
      />
    </motion.button>
  );
}

