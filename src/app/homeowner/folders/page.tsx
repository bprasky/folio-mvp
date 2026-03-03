'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
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

export default function HomeownerFolders() {
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
        coverImage: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80',
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
    setFolders(folders.filter(folder => folder.id !== id));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="folio-h1 text-[var(--text-primary)] mb-2">My Project Folders</h1>
            <p className="folio-body text-[var(--text-secondary)]">Organize your design inspiration and project ideas</p>
          </motion.div>

          {/* Create New Folder Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            {!isCreating ? (
              <button
                onClick={() => setIsCreating(true)}
                className="bg-[var(--bg-elevated)] rounded-[20px] p-6 shadow-[var(--ridge-shadow)] hover:shadow-lg transition-all duration-300 border-2 border-dashed border-[var(--border-color)] hover:border-[var(--accent)] w-full max-w-md"
              >
                <div className="flex items-center justify-center space-x-3">
                  <FaPlus className="text-[var(--accent)] text-xl" />
                  <span className="folio-ui text-[var(--text-secondary)] font-medium">Create New Folder</span>
                </div>
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <RidgeCard className="p-6 max-w-md">
                  <form onSubmit={handleCreateFolder} className="space-y-4">
                    <div>
                      <label className="block folio-ui font-medium text-[var(--text-secondary)] mb-2">
                        Folder Name
                      </label>
                      <Input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="e.g., Bathroom Renovation"
                        required
                      />
                    </div>
                    <div>
                      <label className="block folio-ui font-medium text-[var(--text-secondary)] mb-2">
                        Description (Optional)
                      </label>
                      <textarea
                        value={newFolderDescription}
                        onChange={(e) => setNewFolderDescription(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-xl focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none folio-body text-[var(--text-primary)]"
                        placeholder="Brief description of your project..."
                      />
                    </div>
                    <div className="flex space-x-3">
                      <Button type="submit" variant="accent" className="flex-1">
                        Create Folder
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="flex-1"
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
          </motion.div>

          {/* Folders Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {folders.map((folder, index) => (
              <motion.div
                key={folder.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <RidgeCard className="overflow-hidden group">
                  {/* Cover Image */}
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={folder.coverImage}
                      alt={folder.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Folder Icon */}
                    <div className="absolute top-4 left-4">
                      {folder.imageCount > 0 ? (
                        <FaFolderOpen className="text-white text-2xl drop-shadow-lg" />
                      ) : (
                        <FaFolder className="text-white text-2xl drop-shadow-lg" />
                      )}
                    </div>

                    {/* Image Count */}
                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                      <div className="flex items-center space-x-1 text-white folio-meta">
                        <FaImage />
                        <span>{folder.imageCount}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="absolute bottom-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button className="bg-white/20 backdrop-blur-sm p-2 rounded-full hover:bg-white/30 transition-colors">
                        <FaEdit className="text-white text-sm" />
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="bg-red-500/20 backdrop-blur-sm p-2 rounded-full hover:bg-red-500/30 transition-colors"
                      >
                        <FaTrash className="text-white text-sm" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="folio-h3 text-[var(--text-primary)] leading-tight">{folder.name}</h3>
                      {folder.isPublic && (
                        <span className="bg-green-100 text-green-800 folio-meta px-2 py-1 rounded-full">
                          Public
                        </span>
                      )}
                    </div>

                    {folder.description && (
                      <p className="folio-body text-[var(--text-secondary)] mb-4 line-clamp-2">{folder.description}</p>
                    )}

                    <div className="flex items-center justify-between folio-meta text-[var(--text-tertiary)] mb-4">
                      <span>Created {folder.createdAt}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/homeowner/folders/${folder.id}`}
                        className="flex-1"
                      >
                        <Button variant="accent" className="w-full">
                          Open Folder
                        </Button>
                      </Link>
                      <button className="p-2 text-[var(--text-tertiary)] hover:text-red-500 transition-colors">
                        <FaHeart />
                      </button>
                      <button className="p-2 text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors">
                        <FaShare />
                      </button>
                    </div>
                  </div>
                </RidgeCard>
              </motion.div>
            ))}
          </motion.div>

          {/* Empty State */}
          {folders.length === 0 && !isCreating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <FaFolder className="text-[var(--text-tertiary)] text-6xl mx-auto mb-4" />
              <h3 className="folio-h3 text-[var(--text-secondary)] mb-2">No folders yet</h3>
              <p className="folio-body text-[var(--text-tertiary)] mb-6">Create your first project folder to get started</p>
              <Button
                variant="accent"
                onClick={() => setIsCreating(true)}
              >
                Create Your First Folder
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
