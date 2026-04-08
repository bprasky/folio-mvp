'use client';

import { motion } from 'framer-motion';

interface ActionIconBarProps {
  onLike?: () => void;
  onSave?: () => void;
  onAddToProject?: () => void;
  onView?: () => void;
  isVisible: boolean;
}

/**
 * Glass-badge action icons that appear on hover over floating 3D products.
 * Like (♡), Add to Project (＋), Save (⤓), View Product (↗).
 */
export function ActionIconBar({
  onLike,
  onSave,
  onAddToProject,
  onView,
  isVisible,
}: ActionIconBarProps) {
  if (!isVisible) return null;

  const iconBtn =
    'w-8 h-8 flex items-center justify-center rounded-full glass-badge text-sm hover:scale-110 transition-transform cursor-pointer';

  return (
    <motion.div
      className="flex items-center gap-2 justify-center mt-2"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
    >
      {onLike && (
        <button className={iconBtn} onClick={onLike} aria-label="Like" title="Like">
          ♡
        </button>
      )}
      {onAddToProject && (
        <button className={iconBtn} onClick={onAddToProject} aria-label="Add to project" title="Add to project">
          ＋
        </button>
      )}
      {onSave && (
        <button className={iconBtn} onClick={onSave} aria-label="Save" title="Save">
          ⤓
        </button>
      )}
      {onView && (
        <button className={iconBtn} onClick={onView} aria-label="View product" title="View product">
          ↗
        </button>
      )}
    </motion.div>
  );
}
