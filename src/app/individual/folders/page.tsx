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
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Folders</h1>
            <p className="text-gray-600">Organize your saved items and inspiration</p>
          </div>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaPlus className="w-4 h-4" />
            New Folder
          </button>
        </div>

        {isCreating && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg mb-6"
          >
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Folder Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Living Room Ideas"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                <textarea
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Describe what this folder contains..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Folder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewFolderName('');
                    setNewFolderDescription('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {folders.map((folder) => (
            <motion.div
              key={folder.id}
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              whileHover={{ scale: 1.02 }}
            >
              <Link href={`/individual/folders/${folder.id}`}>
                <div className="relative h-48 bg-gray-100">
                  {folder.coverImage ? (
                    <Image
                      src={folder.coverImage}
                      alt={folder.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <FaFolderOpen className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      folder.isPublic 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {folder.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              </Link>
              
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{folder.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{folder.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
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
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title="Edit folder"
                    >
                      <FaEdit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}



