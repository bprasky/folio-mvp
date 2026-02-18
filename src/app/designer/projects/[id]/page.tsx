'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FaArrowLeft, FaPlus, FaEye, FaEyeSlash, FaDownload,
  FaUpload, FaHome, FaTag, FaFileAlt, FaCamera
} from 'react-icons/fa';
import CameraCapture from '../../../../components/CameraCapture';
import { ROOM_TEMPLATES } from '../../../project/[id]/roomTemplates';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProjectImageTagger } from '@/components/project/ProjectImageTagger';

interface Project {
  id: string;
  name: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
  rooms: Room[];
  _count: {
    rooms: number;
  };
}

interface Room {
  id: string;
  name: string;
  selections: Selection[];
}

interface Selection {
  id: string;
  photo: string | null;
  notes: string | null;
  vendorId: string | null;
  createdAt: string;
}

export default function ProjectDashboard() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<string>('LIVING');
  
  // New state for project-level selection workflow
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [showImageTagger, setShowImageTagger] = useState(false);

  const projectId = params.id as string;

  useEffect(() => {
    fetchProject();
    fetchProjects();
  }, [projectId]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/designer/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/designer/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data);
        setIsPublic(data.isPublic || false);
      } else {
        console.error('Failed to fetch project');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return;

    try {
      const response = await fetch(`/api/designer/projects/${projectId}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: newRoomName,
          type: newRoomType 
        }),
      });

      if (response.ok) {
        setNewRoomName('');
        setNewRoomType('LIVING');
        setShowAddRoom(false);
        fetchProject(); // Refresh project data
      } else {
        alert('Failed to add room');
      }
    } catch (error) {
      console.error('Error adding room:', error);
      alert('Failed to add room');
    }
  };

  const handleTogglePublic = async () => {
    try {
      const response = await fetch(`/api/designer/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isPublic: !isPublic }),
      });

      if (response.ok) {
        setIsPublic(!isPublic);
        fetchProject(); // Refresh project data
      } else {
        alert('Failed to update project visibility');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project visibility');
    }
  };

  const handleExportSpecSheet = async () => {
    try {
      const response = await fetch(`/api/export-spec-sheet?projectId=${projectId}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project?.name}-spec-sheet.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to export spec sheet');
      }
    } catch (error) {
      console.error('Error exporting spec sheet:', error);
      alert('Failed to export spec sheet');
    }
  };

  // New handlers for project-level selection workflow
  const handleProjectLevelSelection = async (selectionData: any) => {
    try {
      const response = await fetch(`/api/designer/projects/${projectId}/selections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photo: selectionData.photo,
          vendorName: selectionData.vendorName,
          productName: selectionData.productName,
          colorFinish: selectionData.colorFinish,
          notes: selectionData.notes,
          phaseOfUse: selectionData.phaseOfUse,
          gpsLocation: selectionData.gpsLocation,
          source: selectionData.source,
          roomId: selectionData.roomId || null // Can be null for project-level
        }),
      });

      if (response.ok) {
        fetchProject(); // Refresh project data
        alert('Selection added successfully!');
      } else {
        alert('Failed to save selection');
      }
    } catch (error) {
      console.error('Error saving selection:', error);
      alert('Failed to save selection');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-[var(--bg-elevated)] rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-[var(--bg-elevated)] rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <RidgeCard key={i} padding="lg">
                  <div className="h-6 bg-[var(--bg-elevated)] rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-[var(--bg-elevated)] rounded w-1/3"></div>
                </RidgeCard>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <h2 className="folio-h1 text-[var(--text-primary)] mb-4">Project Not Found</h2>
            <p className="folio-body text-[var(--text-secondary)] mb-6">The project you're looking for doesn't exist or you don't have access to it.</p>
            <Button
              variant="accent"
              onClick={() => router.push('/designer')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] p-6">
      <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => router.back()}
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <FaArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h1 className="folio-h1 text-[var(--text-primary)]">{project.name}</h1>
                <p className="folio-body text-[var(--text-secondary)]">{project.category} - {project.description}</p>
              </div>
            </div>

            {/* Project Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="accent"
                onClick={() => setShowCameraCapture(true)}
                className="flex items-center gap-2"
              >
                <FaCamera className="w-4 h-4" />
                + Add Project-Level Selection
              </Button>

              <Button
                variant="ridge"
                onClick={() => setShowAddRoom(true)}
                className="flex items-center gap-2"
              >
                <FaPlus className="w-4 h-4" />
                Add Room
              </Button>

              <Button
                variant={isPublic ? 'accent' : 'ridge'}
                onClick={handleTogglePublic}
                className="flex items-center gap-2"
              >
                {isPublic ? <FaEye className="w-4 h-4" /> : <FaEyeSlash className="w-4 h-4" />}
                {isPublic ? 'Public' : 'Private'}
              </Button>

              <Button
                variant="ridge"
                onClick={() => setShowImageTagger(true)}
                className="flex items-center gap-2"
              >
                <FaTag className="w-4 h-4" />
                Tag Products
              </Button>

              <Button
                variant="ridge"
                onClick={handleExportSpecSheet}
                className="flex items-center gap-2"
              >
                <FaDownload className="w-4 h-4" />
                Export Spec Sheet
              </Button>

              <Button
                variant="ridge"
                className="flex items-center gap-2"
              >
                <FaUpload className="w-4 h-4" />
                Upload Files
              </Button>
            </div>
          </motion.div>

          {/* Add Room Modal */}
          {showAddRoom && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <RidgeCard padding="lg" className="w-full max-w-md mx-4">
                  <h3 className="folio-h2 text-[var(--text-primary)] mb-4">Add New Room</h3>

                  <div className="mb-4">
                    <label htmlFor="room-type" className="block folio-body font-medium text-[var(--text-primary)] mb-2">
                      Room Type
                    </label>
                    <select
                      id="room-type"
                      value={newRoomType}
                      onChange={(e) => setNewRoomType(e.target.value)}
                      className="w-full ridge-input px-4 py-3"
                    >
                      {Object.entries(ROOM_TEMPLATES).map(([key, template]) => (
                        <option key={key} value={key}>
                          {template.type.charAt(0) + template.type.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>

                    {/* Preview of expected slots */}
                    {newRoomType && (
                      <div className="mt-2 p-3 bg-[var(--accent)]/10 rounded-lg">
                        <div className="text-xs font-medium text-[var(--accent)] mb-1">
                          Expected items ({ROOM_TEMPLATES[newRoomType as keyof typeof ROOM_TEMPLATES].slots.length}):
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {ROOM_TEMPLATES[newRoomType as keyof typeof ROOM_TEMPLATES].slots
                            .map(slot => slot.label)
                            .join(', ')}
                        </div>
                      </div>
                    )}
                  </div>

                  <Input
                    variant="ridge"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Room name (e.g., Living Room, Kitchen)"
                    className="mb-4"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddRoom()}
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="accent"
                      onClick={handleAddRoom}
                      className="flex-1"
                    >
                      Add Room
                    </Button>
                    <Button
                      variant="ridge"
                      onClick={() => setShowAddRoom(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </RidgeCard>
              </motion.div>
            </motion.div>
          )}

          {/* Rooms Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {project.rooms.map((room, index) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <RidgeCard
                  padding="lg"
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/designer/projects/${projectId}/rooms/${room.id}`)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="folio-h3 text-[var(--text-primary)]">{room.name}</h3>
                    <FaHome className="w-5 h-5 text-[var(--text-tertiary)]" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 folio-meta">
                      <FaTag className="w-4 h-4" />
                      <span>{room.selections.length} selections</span>
                    </div>

                    {room.selections.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {room.selections.slice(0, 4).map((selection) => (
                          <div
                            key={selection.id}
                            className="aspect-square bg-[var(--bg-elevated)] rounded-lg flex items-center justify-center"
                          >
                            {selection.photo ? (
                              <img
                                src={selection.photo}
                                alt="Selection"
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <FaFileAlt className="w-6 h-6 text-[var(--text-tertiary)]" />
                            )}
                          </div>
                        ))}
                        {room.selections.length > 4 && (
                          <div className="aspect-square bg-[var(--bg-elevated)] rounded-lg flex items-center justify-center">
                            <span className="folio-meta">+{room.selections.length - 4} more</span>
                          </div>
                        )}
                      </div>
                    )}

                    <Button variant="ridge" size="sm" className="w-full mt-4">
                      Manage Room
                    </Button>
                  </div>
                </RidgeCard>
              </motion.div>
            ))}
          </motion.div>

          {/* Empty State */}
          {project.rooms.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center py-16"
            >
              <RidgeCard padding="xl" className="max-w-md mx-auto">
                <FaHome className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
                <h3 className="folio-h2 text-[var(--text-primary)] mb-2">No Rooms Yet</h3>
                <p className="folio-body text-[var(--text-secondary)] mb-6">
                  Start by adding rooms to organize your project selections
                </p>
                <Button
                  variant="accent"
                  onClick={() => setShowAddRoom(true)}
                >
                  Add Your First Room
                </Button>
              </RidgeCard>
            </motion.div>
          )}
      </div>

      {/* Camera Capture Modal for Project-Level Selections */}
      <CameraCapture
        isOpen={showCameraCapture}
        onClose={() => setShowCameraCapture(false)}
        onSave={handleProjectLevelSelection}
        currentProjectId={projectId}
        projects={projects}
        isProjectLevel={true}
      />

      {/* Manual Image Tagger */}
      {showImageTagger && (
        <ProjectImageTagger
          projectId={projectId}
          onClose={() => setShowImageTagger(false)}
        />
      )}
    </div>
  );
} 