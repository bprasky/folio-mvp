'use client';

import React, { useState, useEffect } from 'react';
import ActionItemCard, { ActionItem } from './ActionItemCard';

interface ActionItemsListProps {
  projectId?: string;
  roomId?: string;
  productTagId?: string;
  statusFilter?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  showCompleted?: boolean;
}

export default function ActionItemsList({
  projectId,
  roomId,
  productTagId,
  statusFilter,
  showCompleted = false,
}: ActionItemsListProps) {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActionItems();
  }, [projectId, roomId, productTagId, statusFilter, showCompleted]);

  const fetchActionItems = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      if (roomId) params.set('roomId', roomId);
      if (productTagId) params.set('productTagId', productTagId);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/action-items?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch action items');
      }

      const data = await response.json();
      
      // Filter out completed if showCompleted is false
      const filtered = showCompleted
        ? data
        : data.filter((item: ActionItem) => item.status !== 'COMPLETED');

      setActionItems(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load action items');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: ActionItem['status']) => {
    try {
      const response = await fetch(`/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update action item');
      }

      // Refresh list
      fetchActionItems();
    } catch (err) {
      console.error('Error updating action item:', err);
    }
  };

  const handleComplete = async (id: string) => {
    await handleStatusChange(id, 'COMPLETED');
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading action items...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        {error}
      </div>
    );
  }

  if (actionItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No action items found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actionItems.map((item) => (
        <ActionItemCard
          key={item.id}
          actionItem={item}
          onStatusChange={handleStatusChange}
          onComplete={handleComplete}
        />
      ))}
    </div>
  );
}








