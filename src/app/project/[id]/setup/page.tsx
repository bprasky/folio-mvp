'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProjectCreationModal from '@/components/ProjectCreationModal';

/**
 * Project Setup Page - Onboarding flow for new projects
 * Handles image upload and product tagging using ProjectCreationModal
 */
export default function ProjectSetupPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // Fetch project data
    const loadProject = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setProject(data);
          // Open modal after project loads
          setModalOpen(true);
        } else {
          console.error('Failed to load project');
          router.push(`/project/${projectId}`);
        }
      } catch (error) {
        console.error('Error loading project:', error);
        router.push(`/project/${projectId}`);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId, router]);

  const handleSetupComplete = (updatedProject: any) => {
    // Setup complete - go to project page
    router.push(`/project/${projectId}`);
  };

  const handleClose = () => {
    // User canceled - go to project page
    setModalOpen(false);
    router.push(`/project/${projectId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Project not found</p>
          <Link
            href="/designer"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Return to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Background for modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
      
      {/* Modal Container */}
      <ProjectCreationModal
        isOpen={modalOpen}
        onClose={handleClose}
        onProjectCreated={handleSetupComplete}
        editingProject={project}
      />
    </div>
  );
}

