'use client';

import React, { useState } from 'react';
import { FaTimes, FaTag } from 'react-icons/fa';
import ActionItemsPanel from './ActionItemsPanel';

interface ProductTagPanelProps {
  productTagId: string;
  productName: string;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductTagPanel({
  productTagId,
  productName,
  projectId,
  isOpen,
  onClose,
}: ProductTagPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FaTag className="text-[var(--accent)]" />
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">{productName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <ActionItemsPanel productTagId={productTagId} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}








