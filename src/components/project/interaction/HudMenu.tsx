'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface HudMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onViewProduct?: () => void;
  onAddToProject?: () => void;
  onSave?: () => void;
  onDownload3D?: () => void;
  isSaved?: boolean;
  isInProject?: boolean;
}

interface HudAction {
  key: string;
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * HUD quick-action menu for tag expansion cards and hologram expansions.
 * Desktop: vertical stack within the card.
 * Mobile: bottom sheet with 56px action rows.
 */
export function HudMenu({
  isOpen,
  onClose,
  onViewProduct,
  onAddToProject,
  onSave,
  onDownload3D,
  isSaved = false,
  isInProject = false,
}: HudMenuProps) {
  const actions: HudAction[] = [];

  if (onViewProduct) {
    actions.push({
      key: 'view',
      icon: '→',
      label: 'View Product',
      onClick: onViewProduct,
    });
  }

  if (onAddToProject) {
    actions.push({
      key: 'add',
      icon: isInProject ? '✓' : '⊞',
      label: isInProject ? 'Added' : 'Add to Project',
      onClick: isInProject ? undefined : onAddToProject,
      disabled: isInProject,
    });
  }

  if (onSave) {
    actions.push({
      key: 'save',
      icon: isSaved ? '♥' : '♡',
      label: isSaved ? 'Saved' : 'Save',
      onClick: onSave,
    });
  }

  if (onDownload3D) {
    actions.push({
      key: 'download',
      icon: '⤓',
      label: 'Download 3D',
      onClick: onDownload3D,
    });
  }

  if (!actions.length) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile) {
    return (
      <MobileBottomSheet
        isOpen={isOpen}
        onClose={onClose}
        actions={actions}
      />
    );
  }

  return (
    <DesktopStack
      isOpen={isOpen}
      actions={actions}
    />
  );
}

function DesktopStack({
  isOpen,
  actions,
}: {
  isOpen: boolean;
  actions: HudAction[];
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="px-3 pb-3"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="border-t border-black/5 pt-2 flex flex-col gap-1">
            {actions.map((action, i) => (
              <motion.button
                key={action.key}
                type="button"
                className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-left transition-colors ${
                  action.disabled
                    ? 'text-folio-text-tertiary cursor-default'
                    : 'text-folio-text-primary hover:bg-black/5'
                }`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.15 }}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick?.();
                }}
                disabled={action.disabled}
              >
                <span className="w-5 text-center text-sm" style={{ color: 'var(--tag-hud-accent)' }}>
                  {action.icon}
                </span>
                <span className="text-[var(--type-eyebrow)] font-medium">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MobileBottomSheet({
  isOpen,
  onClose,
  actions,
}: {
  isOpen: boolean;
  onClose: () => void;
  actions: HudAction[];
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60] bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-2xl"
            style={{
              background: 'var(--tag-hud-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-black/10" />
            </div>

            {/* Actions */}
            <div className="pb-safe-area-inset-bottom pb-4">
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className={`flex items-center gap-4 w-full px-6 transition-colors ${
                    action.disabled
                      ? 'text-folio-text-tertiary'
                      : 'text-folio-text-primary active:bg-black/5'
                  }`}
                  style={{ height: 56 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick?.();
                    if (!action.disabled) onClose();
                  }}
                  disabled={action.disabled}
                >
                  <span className="w-6 text-center text-base" style={{ color: 'var(--tag-hud-accent)' }}>
                    {action.icon}
                  </span>
                  <span className="text-[var(--type-ui)] font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
