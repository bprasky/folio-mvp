'use client';

import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

interface CreateActionItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sourceNoteId?: string;
  projectId?: string;
  roomId?: string;
  productTagId?: string;
  defaultTitle?: string;
}

export default function CreateActionItemModal({
  isOpen,
  onClose,
  onSuccess,
  sourceNoteId,
  projectId,
  roomId,
  productTagId,
  defaultTitle = '',
}: CreateActionItemModalProps) {
  const [formData, setFormData] = useState({
    title: defaultTitle,
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    assignedToId: '',
    dueDate: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const endpoint = productTagId
        ? `/api/project-product-tags/${productTagId}/action-items`
        : '/api/action-items';

      const body: any = {
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        sourceNoteId: sourceNoteId || undefined,
        assignedToId: formData.assignedToId || undefined,
        dueDate: formData.dueDate || undefined,
      };

      if (projectId) body.projectId = projectId;
      if (roomId) body.roomId = roomId;
      if (productTagId) body.productTagId = productTagId;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create action item');
      }

      onSuccess();
      onClose();
      // Reset form
      setFormData({
        title: '',
        description: '',
        priority: 'MEDIUM',
        assignedToId: '',
        dueDate: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create action item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface-canvas rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-folio-text-primary">Create Action Item</h2>
          <button
            onClick={onClose}
            className="text-folio-text-tertiary hover:text-folio-text-secondary"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-folio-text-primary mb-1">
              Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-folio-border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-folio-text-primary mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-folio-border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-folio-text-primary mb-1">
              Priority
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-folio-border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-folio-text-primary mb-1">
              Due Date
            </label>
            <input
              type="date"
              id="dueDate"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-folio-border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-folio-border-subtle rounded-md text-folio-text-primary hover:bg-surface-ground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}








