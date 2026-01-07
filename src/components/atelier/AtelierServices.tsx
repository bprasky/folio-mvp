"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPalette, FaSwatchbook, FaLayerGroup, FaColumns, FaTimes } from 'react-icons/fa';

interface AtelierService {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: React.ReactNode;
}

const services: AtelierService[] = [
  {
    id: 'palette-curation',
    name: 'Palette Curation',
    description: 'Expert color consultation and palette development',
    price: 29,
    icon: <FaPalette className="w-6 h-6" />,
  },
  {
    id: 'finish-selections',
    name: 'Finish Selections',
    description: 'Curated material and finish recommendations',
    price: 79,
    icon: <FaSwatchbook className="w-6 h-6" />,
  },
  {
    id: 'room-moodboard',
    name: 'Room Moodboard',
    description: 'Visual concept development for your space',
    price: 149,
    icon: <FaLayerGroup className="w-6 h-6" />,
  },
  {
    id: 'concept-board',
    name: 'Concept Board',
    description: 'Comprehensive design direction and vision',
    price: 199,
    icon: <FaColumns className="w-6 h-6" />,
  },
];

interface AtelierServicesProps {
  onServiceSelect?: (service: AtelierService) => void;
}

export default function AtelierServices({ onServiceSelect }: AtelierServicesProps) {
  const [selectedService, setSelectedService] = useState<AtelierService | null>(null);

  const handleTileClick = (service: AtelierService) => {
    setSelectedService(service);
    if (onServiceSelect) {
      onServiceSelect(service);
    }
  };

  const handlePurchase = () => {
    // Placeholder purchase logic
    console.log('Purchase service:', selectedService);
    alert(`Purchase ${selectedService?.name} for $${selectedService?.price}`);
    setSelectedService(null);
  };

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-serif text-folio-ink mb-2">Atelier Services</h2>
        <p className="text-folio-stone-500 text-sm">Professional design consultation services</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {services.map((service, index) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            onClick={() => handleTileClick(service)}
            className="group relative cursor-pointer"
          >
            <div className="relative bg-white/70 backdrop-blur-md border border-folio-stone-100 rounded-2xl p-6 hover:shadow-folio2 transition-all duration-300 hover:border-folio-accent-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-folio-accent-700 group-hover:text-folio-accent-400 transition-colors">
                  {service.icon}
                </div>
                <span className="text-2xl font-serif text-folio-ink">${service.price}</span>
              </div>
              <h3 className="text-lg font-serif text-folio-ink mb-2">{service.name}</h3>
              <p className="text-sm text-folio-stone-500 leading-relaxed">{service.description}</p>
              
              <div className="mt-4 pt-4 border-t border-folio-stone-100">
                <span className="text-xs text-folio-stone-400 group-hover:text-folio-accent-400 transition-colors">
                  Learn more →
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Purchase Modal */}
      <AnimatePresence>
        {selectedService && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedService(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/90 backdrop-blur-md rounded-2xl p-8 max-w-md w-full shadow-folio3"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-serif text-folio-ink">{selectedService.name}</h3>
                <button
                  onClick={() => setSelectedService(null)}
                  className="text-folio-stone-400 hover:text-folio-ink transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-folio-stone-600 mb-4">{selectedService.description}</p>
                <div className="text-3xl font-serif text-folio-ink mb-6">${selectedService.price}</div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handlePurchase}
                  className="flex-1 bg-folio-accent-700 text-white px-6 py-3 rounded-xl hover:bg-folio-accent-400 transition-colors font-medium"
                >
                  Purchase Now
                </button>
                <button
                  onClick={() => setSelectedService(null)}
                  className="px-6 py-3 border border-folio-stone-300 text-folio-ink rounded-xl hover:bg-folio-stone-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
