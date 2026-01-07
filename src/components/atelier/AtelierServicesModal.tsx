"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPalette, FaSwatchbook, FaLayerGroup, FaColumns, FaTimes } from 'react-icons/fa';
import AtelierServices from './AtelierServices';

interface AtelierServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AtelierServicesModal({ isOpen, onClose }: AtelierServicesModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="min-h-screen p-4 md:p-8"
        >
          <div className="max-w-4xl mx-auto bg-folio-bg rounded-2xl p-6 md:p-8 shadow-folio3 mt-8 mb-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-serif text-folio-ink mb-2">Folio Atelier Services</h2>
                <p className="text-folio-stone-500 text-sm font-sans">Professional design consultation services</p>
              </div>
              <button
                onClick={onClose}
                className="text-folio-stone-400 hover:text-folio-ink transition-colors p-2 rounded-lg hover:bg-folio-stone-100"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            
            <AtelierServices />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
