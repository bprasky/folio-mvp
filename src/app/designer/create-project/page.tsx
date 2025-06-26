'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import Navigation from '../../../components/Navigation';
import ProjectCreationModal from '../../../components/ProjectCreationModal';

export default function DesignerCreateProject() {
  const [isModalOpen, setIsModalOpen] = useState(true);

  const handleModalClose = () => {
    setIsModalOpen(false);
    // Redirect back to designer dashboard after closing
    window.location.href = '/designer';
  };

  const handleProjectCreated = (projectData: any) => {
    console.log('Project created:', projectData);
    // Handle successful project creation
    setIsModalOpen(false);
    // Redirect to the new project or back to dashboard
    window.location.href = '/designer';
  };

  return (
    <div className="min-h-screen bg-primary flex">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8"
          >
            <Link
              href="/designer"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <FaArrowLeft />
              <span>Back to Designer Dashboard</span>
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Create New Project</h1>
            <p className="text-gray-600">
              Share your design work with the community and tag products for easy discovery
            </p>
          </motion.div>

          {/* Project Creation Modal */}
          <ProjectCreationModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            onProjectCreated={handleProjectCreated}
          />

          {/* If modal is closed, show a fallback */}
          {!isModalOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md mx-auto">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Ready to Create?</h2>
                <p className="text-gray-600 mb-6">
                  Click the button below to start creating your new project
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium"
                >
                  Start Creating
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
} 