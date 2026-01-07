'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  FaPlus, FaArrowLeft, FaCamera, FaFileUpload, FaEdit, FaTrash, 
  FaTag, FaStickyNote, FaSave, FaTimes, FaPalette, FaUpload 
} from 'react-icons/fa';
import CameraCapture from '../../../../../../components/CameraCapture';

interface Room {
  id: string;
  name: string;
  projectId: string;
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
  phaseOfUse: string | null;
  gpsLocation: string | null;
  source: string;
  timestamp: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  category: string;
}

export default function RoomManagementPage() {
  const params = useParams();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddSelection, setShowAddSelection] = useState(false);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [editingSelection, setEditingSelection] = useState<Selection | null>(null);
  const [newSelection, setNewSelection] = useState({
    photo: '',
    notes: '',
    vendorId: ''
  });
  const [projects, setProjects] = useState<any[]>([]);

  const projectId = params.id as string;
  const roomId = params.roomId as string;

  useEffect(() => {
    fetchRoomData();
    fetchProjects();
  }, [projectId, roomId]);

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

  const fetchRoomData = async () => {
    try {
      const [roomResponse, projectResponse] = await Promise.all([
        fetch(`/api/designer/projects/${projectId}/rooms/${roomId}`),
        fetch(`/api/designer/projects/${projectId}`)
      ]);

      if (roomResponse.ok && projectResponse.ok) {
        const roomData = await roomResponse.json();
        const projectData = await projectResponse.json();
        setRoom(roomData);
        setProject(projectData);
      } else {
        console.error('Failed to fetch room or project data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSelection = async () => {
    if (!newSelection.photo.trim() && !newSelection.notes.trim()) {
      alert('Please provide either a photo URL or notes');
      return;
    }

    try {
      const response = await fetch(`/api/designer/projects/${projectId}/rooms/${roomId}/selections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photo: newSelection.photo || null,
          notes: newSelection.notes || null,
          vendorId: newSelection.vendorId || null
        }),
      });

      if (response.ok) {
        setNewSelection({ photo: '', notes: '', vendorId: '' });
        setShowAddSelection(false);
        fetchRoomData(); // Refresh data
      } else {
        alert('Failed to add selection');
      }
    } catch (error) {
      console.error('Error adding selection:', error);
      alert('Failed to add selection');
    }
  };

  const handleUpdateSelection = async () => {
    if (!editingSelection) return;

    try {
      const response = await fetch(`/api/designer/projects/${projectId}/rooms/${roomId}/selections/${editingSelection.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photo: newSelection.photo || null,
          notes: newSelection.notes || null,
          vendorId: newSelection.vendorId || null
        }),
      });

      if (response.ok) {
        setEditingSelection(null);
        setNewSelection({ photo: '', notes: '', vendorId: '' });
        fetchRoomData(); // Refresh data
      } else {
        alert('Failed to update selection');
      }
    } catch (error) {
      console.error('Error updating selection:', error);
      alert('Failed to update selection');
    }
  };

  const handleDeleteSelection = async (selectionId: string) => {
    if (!confirm('Are you sure you want to delete this selection?')) return;

    try {
      const response = await fetch(`/api/designer/projects/${projectId}/rooms/${roomId}/selections/${selectionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchRoomData(); // Refresh data
      } else {
        alert('Failed to delete selection');
      }
    } catch (error) {
      console.error('Error deleting selection:', error);
      alert('Failed to delete selection');
    }
  };

  const handleCameraCaptureSave = async (selectionData: any) => {
    try {
      const response = await fetch(`/api/designer/projects/${projectId}/rooms/${roomId}/selections`, {
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
          source: selectionData.source
        }),
      });

      if (response.ok) {
        fetchRoomData(); // Refresh data
        alert('Material captured successfully!');
      } else {
        alert('Failed to save material');
      }
    } catch (error) {
      console.error('Error saving material:', error);
      alert('Failed to save material');
    }
  };

  const startEditing = (selection: Selection) => {
    setEditingSelection(selection);
    setNewSelection({
      photo: selection.photo || '',
      notes: selection.notes || '',
      vendorId: selection.vendorId || ''
    });
  };

  const cancelEditing = () => {
    setEditingSelection(null);
    setNewSelection({ photo: '', notes: '', vendorId: '' });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading room...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!room || !project) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Room Not Found</h2>
            <p className="text-gray-600 mb-6">The room you're looking for doesn't exist.</p>
            <button
              onClick={() => router.push(`/designer/projects/${projectId}`)}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Back to Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
        <div className="max-w-7xl mx-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => router.push(`/designer/projects/${projectId}`)}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FaArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">{room.name}</h1>
                <p className="text-gray-600">{project.name} • {project.category}</p>
              </div>
              <button
                onClick={() => setShowAddSelection(true)}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                <FaPlus className="w-4 h-4" />
                + Add Selection
              </button>
            </div>
          </motion.div>

          {/* Add Selection Modal with Camera/Upload Options */}
          {showAddSelection && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Add Selection</h3>
                  <button
                    onClick={() => setShowAddSelection(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="space-y-6">
                  {/* Capture Options */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">How would you like to add this selection?</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => {
                          setShowAddSelection(false);
                          setShowCameraCapture(true);
                        }}
                        className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
                      >
                        <FaCamera className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                        <h5 className="font-semibold text-gray-900 mb-2">Take Photo</h5>
                        <p className="text-sm text-gray-600">Use your device camera to capture the product</p>
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowAddSelection(false);
                          setShowUploadModal(true);
                        }}
                        className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
                      >
                        <FaUpload className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                        <h5 className="font-semibold text-gray-900 mb-2">Upload Image</h5>
                        <p className="text-sm text-gray-600">Choose from your photo library or files</p>
                      </button>
                    </div>
                  </div>
                  
                  {/* Quick Add Option */}
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Or add without image</h4>
                    <button
                      onClick={() => {
                        setShowAddSelection(false);
                        setShowQuickAddModal(true);
                      }}
                      className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
                    >
                      <FaStickyNote className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                      <span className="font-semibold text-gray-900">Add Notes Only</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Quick Add Modal */}
          {showQuickAddModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl p-6 w-full max-w-md mx-4"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Add Selection</h3>
                  <button
                    onClick={() => setShowQuickAddModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={newSelection.notes}
                      onChange={(e) => setNewSelection(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Describe this selection, materials, specifications..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vendor ID (optional)
                    </label>
                    <input
                      type="text"
                      value={newSelection.vendorId}
                      onChange={(e) => setNewSelection(prev => ({ ...prev, vendorId: e.target.value }))}
                      placeholder="Vendor identifier"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleAddSelection}
                    className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Add Selection
                  </button>
                  <button
                    onClick={() => setShowQuickAddModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Edit Selection Modal */}
          {editingSelection && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl p-6 w-full max-w-md mx-4"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Selection</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Photo URL (optional)
                    </label>
                    <input
                      type="url"
                      value={newSelection.photo}
                      onChange={(e) => setNewSelection(prev => ({ ...prev, photo: e.target.value }))}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={newSelection.notes}
                      onChange={(e) => setNewSelection(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Describe this selection, materials, specifications..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vendor ID (optional)
                    </label>
                    <input
                      type="text"
                      value={newSelection.vendorId}
                      onChange={(e) => setNewSelection(prev => ({ ...prev, vendorId: e.target.value }))}
                      placeholder="Vendor identifier"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleUpdateSelection}
                    className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Update Selection
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Selections Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {room.selections.map((selection, index) => (
              <motion.div
                key={selection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Image */}
                <div className="aspect-square bg-gray-200 relative">
                  {selection.photo ? (
                    <img
                      src={selection.photo}
                      alt="Selection"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FaCamera className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={() => startEditing(selection)}
                      className="p-2 bg-white bg-opacity-90 rounded-lg hover:bg-opacity-100 transition-all"
                    >
                      <FaEdit className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteSelection(selection.id)}
                      className="p-2 bg-white bg-opacity-90 rounded-lg hover:bg-opacity-100 transition-all"
                    >
                      <FaTrash className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  {/* Product Information */}
                  {selection.productName && (
                    <div className="mb-2">
                      <h4 className="font-semibold text-gray-900 text-sm">{selection.productName}</h4>
                      {selection.vendorName && (
                        <p className="text-xs text-gray-600">{selection.vendorName}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Color/Finish */}
                  {selection.colorFinish && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FaPalette className="w-3 h-3" />
                        <span>{selection.colorFinish}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Phase of Use */}
                  {selection.phaseOfUse && (
                    <div className="mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        selection.phaseOfUse === 'final_spec' 
                          ? 'bg-green-100 text-green-800'
                          : selection.phaseOfUse === 'pending_approval'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {selection.phaseOfUse.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  )}
                  
                  {/* Notes */}
                  {selection.notes && (
                    <div className="mb-3">
                      <div className="flex items-start gap-2">
                        <FaStickyNote className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700 line-clamp-3">{selection.notes}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Source and Location */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                    <span className="flex items-center gap-1">
                      {selection.source === 'camera' ? (
                        <FaCamera className="w-3 h-3" />
                      ) : (
                        <FaUpload className="w-3 h-3" />
                      )}
                      {selection.source}
                    </span>
                    <span>{new Date(selection.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Empty State */}
          {room.selections.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center py-16"
            >
              <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md mx-auto">
                <FaCamera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Selections Yet</h3>
                <p className="text-gray-600 mb-6">
                  Start adding inspiration images and product selections to this room
                </p>
                <button
                  onClick={() => setShowAddSelection(true)}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  + Add Selection
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Camera Capture Modal */}
      <CameraCapture
        isOpen={showCameraCapture}
        onClose={() => setShowCameraCapture(false)}
        onSave={handleCameraCaptureSave}
        currentProjectId={projectId}
        currentRoomId={roomId}
        projects={projects}
        rooms={room ? [room] : []}
        preloadedImage={newSelection.photo || undefined}
        isProjectLevel={false}
      />

      {/* Upload Modal */}
      {showUploadModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md mx-4"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Upload Image</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <FaUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Choose an image from your device</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        const result = e.target?.result as string;
                        setNewSelection(prev => ({ ...prev, photo: result }));
                        setShowUploadModal(false);
                        setShowCameraCapture(true); // Use camera capture for specs with preloaded image
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  Select Image
                </label>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
} 