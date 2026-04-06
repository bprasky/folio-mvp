'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaRobot, FaStar, FaUsers, FaDollarSign, FaFilter } from 'react-icons/fa';

interface AIUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  savedItemsCount: number;
}

export default function AIUpgradeModal({
  isOpen,
  onClose,
  onUpgrade,
  savedItemsCount
}: AIUpgradeModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 glass-backdrop flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass-overlay p-8 max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <FaRobot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-folio-text mb-2">
                  Unlock FOLIO AI
                </h2>
                <p className="text-folio-system">
                  Turn on FOLIO AI to unlock personalized guidance and designer matches.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>

          {/* Benefits */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FaStar className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-folio-text-primary">Tailored Design Help</h3>
                <p className="text-sm text-folio-text-secondary">Get personalized recommendations based on your saved items</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <FaUsers className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <div>
                <h3 className="font-semibold text-folio-text-primary">Style Analysis</h3>
                <p className="text-sm text-folio-text-secondary">AI analyzes your taste to match you with perfect designers</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FaDollarSign className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-folio-text-primary">Budget Filtering</h3>
                <p className="text-sm text-folio-text-secondary">See products and services within your price range</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FaFilter className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-folio-text-primary">Smart Curation</h3>
                <p className="text-sm text-folio-text-secondary">Skip the overwhelm - see only what fits your project</p>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6">
            <p className="text-center text-sm text-folio-text-primary mb-4">
              <strong>Ready to level up your design process?</strong><br />
              Turn on Folio AI to unlock personalized guidance and designer matches.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-folio-border-subtle text-folio-text-primary rounded-xl hover:bg-surface-ground transition-colors font-medium"
            >
              Keep browsing
            </button>
            <motion.button
              onClick={onUpgrade}
              className="w-full bg-folio-accent text-white py-3-6ounded-lg font-semibold hover:bg-folio-accent/90 transition-colors"
            >
              Turn on FOLIO AI
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
} 