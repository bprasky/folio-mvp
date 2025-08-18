'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  FaArrowLeft, FaPlus, FaEye, FaEyeSlash, FaDownload, 
  FaUpload, FaHome, FaTag, FaFileAlt, FaCamera, FaShare
} from 'react-icons/fa';
import CameraCapture from '../../../../components/CameraCapture';

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
  vendorName: string | null;
  productName: string | null;
  colorFinish: string | null;
  unitPrice: number | null;
  quantity: number | null;
  createdAt: string;
}

export default function VendorProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  
  // New state for project-level selection workflow
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

  const projectId = params.id as string;

  useEffect(() => {
    fetchProject();
    fetchProjects();
  }, [projectId]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/vendor/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Error fetching vendor projects:', error);
    }
  };

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/vendor/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data);
        setIsPublic(data.isPublic || false);
      } else {
        console.error('Failed to fetch vendor project');
      }
    } catch (error) {
      console.error('Error fetching vendor project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRoom = async () => {
    if (!newRoomName.trim() || isAddingRoom) return;

    setIsAddingRoom(true);
    try {
      const response = await fetch(`/api/vendor/projects/${projectId}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newRoomName }),
      });

      if (response.ok) {
        setNewRoomName('');
        setShowAddRoom(false);
        fetchProject();
      } else {
        console.error('Failed to add room');
      }
    } catch (error) {
      console.error('Error adding room:', error);
    } finally {
      setIsAddingRoom(false);
    }
  };

  const handleTogglePublic = async () => {
    try {
      const response = await fetch(`/api/vendor/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isPublic: !isPublic }),
      });

      if (response.ok) {
        setIsPublic(!isPublic);
      } else {
        console.error('Failed to toggle project visibility');
      }
    } catch (error) {
      console.error('Error toggling project visibility:', error);
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
        console.error('Failed to export spec sheet');
      }
    } catch (error) {
      console.error('Error exporting spec sheet:', error);
    }
  };

  const handleProjectLevelSelection = async (selectionData: any) => {
    try {
      const response = await fetch(`/api/vendor/projects/${projectId}/selections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectionData),
      });

      if (response.ok) {
        setShowCameraCapture(false);
        fetchProject();
      } else {
        console.error('Failed to add project-level selection');
      }
    } catch (error) {
      console.error('Error adding project-level selection:', error);
    }
  };

  const handleSendToDesigner = async () => {
    try {
      const response = await fetch(`/api/vendor/projects/${projectId}/handoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        fetchProject();
      } else {
        console.error('Failed to send project to designer');
      }
    } catch (error) {
      console.error('Error sending project to designer:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-lg">
                  <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h2>
            <p className="text-gray-600 mb-6">The project you're looking for doesn't exist or you don't have access to it.</p>
            <button
              onClick={() => router.push('/vendor/dashboard')}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
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
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <FaArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-600">{project.category} • {project.description}</p>
            </div>
          </div>

          {/* Project Actions */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setShowCameraCapture(true)}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <FaCamera className="w-4 h-4" />
              + Add Project-Level Selection
            </button>
            
            <button
              onClick={() => setShowAddRoom(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <FaPlus className="w-4 h-4" />
              Add Room
            </button>
            
            <button
              onClick={handleTogglePublic}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                isPublic 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isPublic ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
              {isPublic ? 'Make Private' : 'Make Public'}
            </button>
            
            <button
              onClick={handleExportSpecSheet}
              className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
            >
              <FaDownload className="w-4 h-4" />
              Export Spec Sheet
            </button>
            
            <button
              onClick={handleSendToDesigner}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
            >
              <FaShare className="w-4 h-4" />
              Send to Designer
            </button>
          </div>
        </motion.div>

        {/* Rooms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {project.rooms.map((room) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">{room.name}</h3>
                <span className="text-sm text-gray-500">{room.selections.length} selections</span>
              </div>
              
              <div className="space-y-3">
                {room.selections.slice(0, 3).map((selection) => (
                  <div key={selection.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {selection.photo ? (
                      <img 
                        src={selection.photo} 
                        alt="Selection" 
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                        <FaFileAlt className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {selection.productName || 'Untitled Selection'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selection.vendorName || 'No vendor assigned'}
                      </p>
                    </div>
                  </div>
                ))}
                
                {room.selections.length > 3 && (
                  <p className="text-sm text-gray-500 text-center">
                    +{room.selections.length - 3} more selections
                  </p>
                )}
              </div>
              
              <button
                onClick={() => router.push(`/vendor/project/${projectId}/rooms/${room.id}`)}
                className="w-full mt-4 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                View Room
              </button>
            </motion.div>
          ))}
        </div>

        {/* Add Room Modal */}
        {showAddRoom && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Room</h3>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name (e.g., Living Room, Kitchen)"
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleAddRoom()}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleAddRoom}
                  disabled={isAddingRoom}
                  className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center ${
                    isAddingRoom 
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {isAddingRoom ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    'Add Room'
                  )}
                </button>
                <button
                  onClick={() => setShowAddRoom(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Camera Capture Modal */}
        {showCameraCapture && (
          <CameraCapture
            isOpen={showCameraCapture}
            onClose={() => setShowCameraCapture(false)}
            onSave={handleProjectLevelSelection}
            currentProjectId={projectId}
            projects={projects}
            isProjectLevel={true}
          />
        )}
      </div>
    </div>
  );
} 