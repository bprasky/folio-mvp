"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaBriefcase, FaStore } from 'react-icons/fa';
import AtelierServices from './AtelierServices';

interface AtelierCTAsProps {
  onHireProject?: () => void;
}

export default function AtelierCTAs({ onHireProject }: AtelierCTAsProps) {
  const [showAtelierModal, setShowAtelierModal] = useState(false);

  const handleHireProject = () => {
    if (onHireProject) {
      onHireProject();
    } else {
      // Default: navigate to consultation flow
      window.location.href = '/designer/consultation';
    }
  };

  const handleHireAtelier = () => {
    setShowAtelierModal(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <motion.button
          onClick={handleHireProject}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative glass-surface border-2 border-folio-accent-400 rounded-2xl p-8 text-left hover:shadow-folio2 transition-all duration-300 group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-folio-accent-400/20 rounded-xl flex items-center justify-center text-folio-accent-700 group-hover:bg-folio-accent-400/30 transition-colors">
              <FaBriefcase className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif text-folio-ink">Hire for Project</h3>
          </div>
          <p className="text-folio-stone-600 font-sans mb-4">
            Book a consultation to discuss your project needs and get personalized design recommendations.
          </p>
          <span className="text-sm text-folio-accent-400 font-sans font-medium group-hover:text-folio-accent-700 transition-colors">
            Schedule Consultation →
          </span>
        </motion.button>

        <motion.button
          onClick={handleHireAtelier}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative bg-folio-accent-700/10 backdrop-blur-md border-2 border-folio-accent-700 rounded-2xl p-8 text-left hover:shadow-folio2 transition-all duration-300 group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-folio-accent-700/20 rounded-xl flex items-center justify-center text-folio-accent-700 group-hover:bg-folio-accent-700/30 transition-colors">
              <FaStore className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif text-folio-ink">Hire Folio Atelier</h3>
          </div>
          <p className="text-folio-stone-600 font-sans mb-4">
            Explore our curated design services, from palette curation to complete concept development.
          </p>
          <span className="text-sm text-folio-accent-700 font-sans font-medium group-hover:text-folio-accent-400 transition-colors">
            View Services →
          </span>
        </motion.button>
      </div>

      {/* Atelier Services Modal */}
      {showAtelierModal && (
        <div className="fixed inset-0 glass-backdrop z-50 overflow-y-auto">
          <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto bg-folio-bg rounded-2xl p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-serif text-folio-ink">Folio Atelier Services</h2>
                <button
                  onClick={() => setShowAtelierModal(false)}
                  className="text-folio-stone-400 hover:text-folio-ink transition-colors text-2xl"
                >
                  ×
                </button>
              </div>
              <AtelierServices />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
