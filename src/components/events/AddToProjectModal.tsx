'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Project {
  id: string;
  title: string;
}

interface AddToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  eventId?: string;
  eventTitle?: string;
  onSuccess?: (projectId: string) => void;
}

export default function AddToProjectModal({
  isOpen,
  onClose,
  productId,
  eventId,
  eventTitle,
  onSuccess,
}: AddToProjectModalProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [createNew, setCreateNew] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState(
    eventTitle ? `Demo – ${eventTitle} Project` : 'Demo – Moody Living Room Project'
  );

  useEffect(() => {
    if (isOpen && session?.user?.id) {
      fetchProjects();
    }
  }, [isOpen, session]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
        // Auto-select demo project if it exists
        const demoProject = data.find((p: Project) =>
          p.title.toLowerCase().includes('demo')
        );
        if (demoProject) {
          setSelectedProjectId(demoProject.id);
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId && !createNew) return;

    setLoading(true);
    try {
      let projectId = selectedProjectId;

      // Create new project if needed
      if (createNew) {
        const createResponse = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newProjectTitle,
            description: 'Created from event',
            projectType: 'RESIDENTIAL',
            clientType: 'RESIDENTIAL',
            budgetBand: 'UNSPECIFIED',
            stage: 'concept',
          }),
        });

        if (createResponse.ok) {
          const newProject = await createResponse.json();
          projectId = newProject.id;
        } else {
          const errorData = await createResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create project');
        }
      }

      // Add product to project
      const saveResponse = await fetch(
        `/api/products/${productId}/save-to-project`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            sourceEventId: eventId,
          }),
        }
      );

      if (saveResponse.ok) {
        onSuccess?.(projectId);
        // Redirect to project with demo tour parameter
        router.push(`/project/${projectId}?demoTour=events-to-project-1`);
        onClose();
      } else {
        throw new Error('Failed to save product to project');
      }
    } catch (error) {
      console.error('Error adding product to project:', error);
      alert('Failed to add product to project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Add to Project
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Project
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="projectOption"
                  checked={!createNew}
                  onChange={() => setCreateNew(false)}
                  className="mr-2"
                />
                <span className="text-sm">Existing project</span>
              </label>
              {!createNew && (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={!createNew}
                >
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              )}

              <label className="flex items-center">
                <input
                  type="radio"
                  name="projectOption"
                  checked={createNew}
                  onChange={() => setCreateNew(true)}
                  className="mr-2"
                />
                <span className="text-sm">Create new project</span>
              </label>
              {createNew && (
                <input
                  type="text"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={createNew}
                  placeholder="Project title"
                />
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!selectedProjectId && !createNew)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Adding...' : 'Add to Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

