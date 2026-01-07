'use client';

import { useState } from 'react';
import { FaTimes, FaCheckCircle } from 'react-icons/fa';

interface BoostProductModalProps {
  designers: { designer_name: string }[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmBoost: (designerName: string) => void;
}

export default function BoostProductModal({
  designers,
  isOpen,
  onClose,
  onConfirmBoost,
}: BoostProductModalProps) {
  const [selectedDesigner, setSelectedDesigner] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedDesigner) {
      onConfirmBoost(selectedDesigner);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <FaTimes className="text-xl" />
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Boost This Product</h2>

        <p className="text-gray-700 mb-4">Select a designer to collaborate with for boosting this product's visibility:</p>

        <div className="mb-6">
          <label htmlFor="designer-select" className="block text-sm font-medium text-gray-700 mb-2">
            Choose a Designer
          </label>
          <select
            id="designer-select"
            value={selectedDesigner}
            onChange={(e) => setSelectedDesigner(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="">-- Select --</option>
            {designers.map((designer) => (
              <option key={designer.designer_name} value={designer.designer_name}>
                {designer.designer_name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!selectedDesigner}
          className={`w-full py-3 rounded-md shadow-md text-white font-semibold transition flex items-center justify-center ${
            selectedDesigner
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          <FaCheckCircle className="mr-2" /> Confirm Boost
        </button>
      </div>
    </div>
  );
} 