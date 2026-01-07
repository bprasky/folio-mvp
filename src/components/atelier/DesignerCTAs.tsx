"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaBriefcase, FaStore } from 'react-icons/fa';
import AtelierServicesModal from './AtelierServicesModal';

interface DesignerCTAsProps {
  onHireProject?: () => void;
}

export default function DesignerCTAs({ onHireProject }: DesignerCTAsProps) {
  const [showAtelierModal, setShowAtelierModal] = useState(false);

  const handleHireProject = () => {
    if (onHireProject) {
      onHireProject();
    } else {
      // Default: navigate to consultation flow
      window.location.href = '/designer/consultation';
    }
  };

  return (
    <>
      <div className="space-y-3 mt-6 border-t border-folio-stone-100 pt-6">
        <motion.button
          onClick={handleHireProject}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-folio-accent-400 text-white px-4 py-3 rounded-xl hover:bg-folio-accent-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
        >
          <FaBriefcase className="w-4 h-4" />
          Hire for Project
        </motion.button>

        <motion.button
          onClick={() => setShowAtelierModal(true)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-folio-accent-700/10 border border-folio-accent-700 text-folio-accent-700 px-4 py-3 rounded-xl hover:bg-folio-accent-700/20 transition-colors font-medium text-sm flex items-center justify-center gap-2"
        >
          <FaStore className="w-4 h-4" />
          Hire Folio Atelier
        </motion.button>
      </div>

      <AtelierServicesModal 
        isOpen={showAtelierModal} 
        onClose={() => setShowAtelierModal(false)} 
      />
    </>
  );
}
