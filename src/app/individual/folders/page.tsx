'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from '@/components/FolioImage';
import Link from 'next/link';
import {
  FaPlus,
  FaFolder,
  FaFolderOpen,
  FaImage,
  FaTrash,
  FaEdit,
  FaHeart,
  FaShare,
  FaDownload
} from 'react-icons/fa';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Mock data for folders
const mockFolders = [
  {
    id: 1,
    name: 'Living Room Renovation',
    description: 'Modern living room with minimalist design',
    imageCount: 24,
    coverImage: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80',
    createdAt: '2024-01-15',
    isPublic: false
  },
  {
    id: 2,
    name: 'Kitchen Remodel Ideas',
    description: 'Contemporary kitchen with island and modern appliances',
    imageCount: 18,
    coverImage: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=600&q=80',
    createdAt: '2024-01-10',
    isPublic: true
  },
  {
    id: 3,
    name: 'Master Bedroom',
    description: 'Cozy and elegant bedroom design inspiration',
    imageCount: 12,
    coverImage: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=600&q=80',
    createdAt: '2024-01-05',
    isPublic: false
  }
];

export default function IndividualFolders() {
  const [folders, setFolders] = useState(mockFolders);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      const newFolder = {
        id: Date.now(),
        name: newFolderName,
        description: newFolderDescription,
        imageCount: 0,
        coverImage: null,
        createdAt: new Date().toISOString().split('T')[0],
        isPublic: false
      };
      setFolders([newFolder, ...folders]);
      setNewFolderName('');
      setNewFolderDescription('');
      setIsCreating(false);
    }
  };

  const handleDeleteFolder = (id: number) => {
    if (confirm('Are you sure you want to delete this folder?')) {
      setFolders(folders.filter(f => f.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-surface-canvas p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="folio-h1 text-folio-text-primary mb-2">My Folders</h1>
            <p className="folio-body text-folio-text-secondary">Organize your saved items and inspiration</p>
          </div>
          <Button
            variant="accent"
            onClick={() => setIsCreating(!isCreating)}
          >
            <FaPlus className="w-4 h-4 mr-2" />
            New Folder
          </Button>
        </div>

        {isCreating && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <RidgeCard className="p-6">
              <form onSubmit={handleCreateFolder} className="space-y-4">
                <div>
                  <label className="block folio-ui font-medium text-folio-text-secondary mb-2">Folder Name</label>
                  <Input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g., Living Room Ideas"
                    required
                  />
                </div>
                <div>
                  <label className="block folio-ui font-medium text-folio-text-secondary mb-2">Description (optional)</label>
                  <textarea
                    value={newFolderDescription}
                    onChange={(e) => setNewFolderDescription(e.target.value)}
                    className="w-full px-4 py-2 bg-surface-canvas border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none folio-body text-folio-text-primary"
                    rows={3}
                    placeholder="Describe what this folder contains..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" variant="accent">
                    Create Folder
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setIsCreating(false);
                      setNewFolderName('');
                      setNewFolderDescription('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </RidgeCard>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {folders.map((folder) => (
            <motion.div
              key={folder.id}
              whileHover={{ scale: 1.02 }}
            >
              <RidgeCard className="overflow-hidden">
                <Link href={`/individual/folders/${folder.id}`}>
                  <div className="relative h-48 bg-surface-canvas">
                    {folder.coverImage ? (
                      <Image
                        src={folder.coverImage}
                        alt={folder.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <FaFolderOpen className="w-16 h-16 text-folio-text-tertiary" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <span className={`px-3 py-1 rounded-full folio-meta font-medium ${
                        folder.isPublic
                          ? 'bg-green-100 text-green-800'
                          : 'bg-surface-ground text-folio-text-secondary'
                      }`}>
                        {folder.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="folio-ui font-semibold text-folio-text-primary mb-1">{folder.name}</h3>
                      <p className="folio-meta text-folio-text-secondary line-clamp-2">{folder.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2 folio-meta text-folio-text-secondary">
                      <FaImage className="w-4 h-4" />
                      <span>{folder.imageCount} items</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete folder"
                      >
                        <FaTrash className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-folio-text-secondary hover:bg-surface-canvas rounded-lg transition-colors"
                        title="Edit folder"
                      >
                        <FaEdit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </RidgeCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
