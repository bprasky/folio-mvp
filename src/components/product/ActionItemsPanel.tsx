'use client';

import React, { useState } from 'react';
import ActionItemsList from '@/components/action-items/ActionItemsList';
import CreateActionItemModal from '@/components/action-items/CreateActionItemModal';
import { FaPlus } from 'react-icons/fa';

interface ActionItemsPanelProps {
  productTagId: string;
  projectId?: string;
}

export default function ActionItemsPanel({ productTagId, projectId }: ActionItemsPanelProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => {
    setRefreshKey((prev) => prev + 1);
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Action Items</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)] text-white text-sm rounded-md hover:bg-[var(--accent-hover)]"
        >
          <FaPlus />
          New Action Item
        </button>
      </div>

      <ActionItemsList
        key={refreshKey}
        productTagId={productTagId}
        showCompleted={false}
      />

      {showCreateModal && (
        <CreateActionItemModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleSuccess}
          productTagId={productTagId}
          projectId={projectId}
        />
      )}
    </div>
  );
}








