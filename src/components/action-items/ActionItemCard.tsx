'use client';

import React from 'react';
import { FaCheckCircle, FaCircle, FaClock, FaExclamationCircle } from 'react-icons/fa';

export interface ActionItem {
  id: string;
  title: string;
  description?: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | null;
  completedAt?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  sourceNote?: {
    id: string;
    title: string | null;
  } | null;
}

interface ActionItemCardProps {
  actionItem: ActionItem;
  onStatusChange?: (id: string, status: ActionItem['status']) => void;
  onComplete?: (id: string) => void;
}

const priorityColors = {
  LOW: 'bg-surface-ground text-folio-text-primary',
  MEDIUM: 'bg-[var(--accent)]/10 text-[var(--accent-hover)]',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

const statusIcons = {
  PENDING: FaCircle,
  IN_PROGRESS: FaClock,
  COMPLETED: FaCheckCircle,
  CANCELLED: FaExclamationCircle,
};

export default function ActionItemCard({ actionItem, onStatusChange, onComplete }: ActionItemCardProps) {
  const StatusIcon = statusIcons[actionItem.status];
  const isCompleted = actionItem.status === 'COMPLETED';

  const handleComplete = () => {
    if (onComplete) {
      onComplete(actionItem.id);
    } else if (onStatusChange) {
      onStatusChange(actionItem.id, 'COMPLETED');
    }
  };

  return (
    <div
      className={`bg-surface-canvas rounded-lg border-2 p-4 shadow-sm transition-all hover:shadow-md ${
        isCompleted ? 'opacity-60 border-folio-border-subtle' : 'border-folio-border-subtle'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2 flex-1">
          <StatusIcon
            className={`mt-1 ${
              isCompleted ? 'text-green-500' : 'text-folio-text-tertiary'
            }`}
          />
          <div className="flex-1">
            <h3 className={`font-medium text-folio-text-primary ${isCompleted ? 'line-through' : ''}`}>
              {actionItem.title}
            </h3>
            {actionItem.description && (
              <p className="text-sm text-folio-text-secondary mt-1">{actionItem.description}</p>
            )}
          </div>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColors[actionItem.priority]}`}
        >
          {actionItem.priority}
        </span>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-folio-text-secondary">
        <div className="flex items-center gap-3">
          {actionItem.assignedTo && (
            <span>Assigned to: {actionItem.assignedTo.name}</span>
          )}
          {actionItem.dueDate && (
            <span>
              Due: {new Date(actionItem.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
        {!isCompleted && (
          <button
            onClick={handleComplete}
            className="text-[var(--accent)] hover:text-blue-800 font-medium"
          >
            Mark Complete
          </button>
        )}
      </div>

      {actionItem.sourceNote && (
        <div className="mt-2 pt-2 border-t border-folio-border-subtle">
          <span className="text-xs text-folio-text-secondary">
            From note: {actionItem.sourceNote.title || 'Untitled'}
          </span>
        </div>
      )}
    </div>
  );
}








