'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaRobot, FaFolder } from 'react-icons/fa';

interface ProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectName: string, useAI: boolean) => void;
}

export default function ProjectCreationModal({ 
  isOpen, 
  onClose, 
  onCreateProject 
}: ProjectCreationModalProps) {
  const [projectName, setProjectName] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setIsSubmitting(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onCreateProject(projectName.trim(), useAI);
    
    // Reset form
    setProjectName('');
    setUseAI(true);
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create New Project</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSubmitting}
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="e.g., Living Room Renovation"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Folio AI Toggle */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <FaRobot className="w-5 h-5 text-white" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Use Folio AI to guide this project</h3>
                    <motion.button
                      type="button"
                      onClick={() => setUseAI(!useAI)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useAI ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                      disabled={isSubmitting}
                      whileTap={{ scale: 0.95 }}
                    >
                      <motion.span
                        animate={{ x: useAI ? 20 : 2 }}
                        className="inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform"
                      />
                    </motion.button>
                  </div>
                  
                  <p className="text-sm text-gray-600">
                    {useAI 
                      ? "Get personalized design guidance, budget help, and designer matches."
                      : "Create a basic folder to save inspiration without AI guidance."
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <motion.button
                type="submit"
                className={`flex-1 px-6 py-3 rounded-xl font-medium text-white transition-all ${
                  useAI 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600' 
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
                disabled={isSubmitting || !projectName.trim()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    />
                    Creating...
                  </div>
                ) : (
                  <>
                    {useAI ? (
                      <>
                        <FaRobot className="inline w-4 h-4 mr-2" />
                        Start AI Setup
                      </>
                    ) : (
                      <>
                        <FaFolder className="inline w-4 h-4 mr-2" />
                        Create Folder
                      </>
                    )}
                  </>
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 