'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Folder {
  id: string;
  name: string;
}

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onSave: (folderId: string) => void;
  onCreateFolder: (name: string) => void;
}

export const SaveModal: React.FC<SaveModalProps> = ({
  isOpen,
  onClose,
  folders,
  onSave,
  onCreateFolder,
}) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="bg-surface-canvas rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-folio-text-primary">Save to Folder</h2>
            <button
              onClick={onClose}
              className="text-folio-text-tertiary hover:text-folio-text-secondary"
            >
              <span className="sr-only">Close</span>
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {!isCreating ? (
            <>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => onSave(folder.id)}
                    className="w-full text-left px-4 py-2 hover:bg-surface-ground rounded-md transition-colors duration-200"
                  >
                    {folder.name}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsCreating(true)}
                className="mt-4 w-full py-2 px-4 border border-folio-border-subtle rounded-md text-folio-text-primary hover:bg-surface-ground transition-colors duration-200"
              >
                Create New Folder
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="w-full px-4 py-2 border border-folio-border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateFolder}
                  className="flex-1 py-2 px-4 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] transition-colors duration-200"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewFolderName('');
                  }}
                  className="flex-1 py-2 px-4 border border-folio-border-subtle rounded-md text-folio-text-primary hover:bg-surface-ground transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}; 