'use client';

import { useState } from 'react';
import ProjectCreationModal from '@/components/ProjectCreationModal';

interface ProjectMediaManagerProps {
  project: any;
  isOwner: boolean;
}

export default function ProjectMediaManager({ project, isOwner }: ProjectMediaManagerProps) {
  const [showModal, setShowModal] = useState(false);

  if (!isOwner) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Add Images & Tag Products
      </button>

      {showModal && (
        <ProjectCreationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onProjectCreated={(updatedProject) => {
            setShowModal(false);
            // Refresh the page to show new images
            window.location.reload();
          }}
          editingProject={project}
        />
      )}
    </>
  );
}




