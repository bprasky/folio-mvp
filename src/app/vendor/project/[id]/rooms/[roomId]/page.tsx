'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  FaPlus, FaArrowLeft, FaCamera, FaFileUpload, FaEdit, FaTrash, 
  FaTag, FaStickyNote, FaSave, FaTimes, FaPalette, FaUpload, FaQuoteLeft, FaFileAlt,
  FaDownload, FaFilePdf, FaImage, FaLink, FaCheck, FaExclamationTriangle
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
  unitPrice: number | null;
  quantity: number | null;
  specSheetUrl: string | null;
  specSheetFileName: string | null;
  productUrl?: string | null;
  tags?: string[] | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  vendorOrgId: string;
  vendorOrgName?: string;
  ownerId: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function VendorRoomManagementPage() {
  const params = useParams();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddSelection, setShowAddSelection] = useState(false);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [editingSelection, setEditingSelection] = useState<Selection | null>(null);
  const [newSelection, setNewSelection] = useState({
    photo: '',
    notes: '',
    vendorName: '',
    productName: '',
    colorFinish: '',
    unitPrice: '',
    quantity: '1',
    specSheetUrl: '',
    specSheetFileName: '',
    productUrl: '',
    tags: [] as string[],
  });
  const [quoteForm, setQuoteForm] = useState({
    type: 'TEXT' as 'PDF' | 'IMAGE' | 'TEXT',
    content: '',
    file: null as File | null,
  });
  const [projects, setProjects] = useState<any[]>([]);

  const projectId = params.id as string;
  const roomId = params.roomId as string;

  useEffect(() => {
    fetchRoomData();
    fetchProjects();
    fetchUser();
  }, [projectId, roomId]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/vendor/projects');
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
        fetch(`/api/projects/${projectId}/rooms/${roomId}`),
        fetch(`/api/projects/${projectId}`)
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

  const canEdit = () => {
    if (!user || !project) return false;
    return user.role === 'VENDOR' && (
      user.id === project.vendorOrgId || 
      user.id === project.ownerId
    );
  };

  const handleAddSelection = async () => {
    if (!room || !newSelection.productName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/vendor/projects/${projectId}/selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSelection,
          unitPrice: newSelection.unitPrice ? parseFloat(newSelection.unitPrice) : null,
          quantity: parseInt(newSelection.quantity),
          roomId: roomId,
        }),
      });

      if (response.ok) {
        const newSelectionData = await response.json();
        setRoom(prev => prev ? {
          ...prev,
          selections: [...prev.selections, newSelectionData]
        } : null);
        setNewSelection({
          photo: '',
          notes: '',
          vendorName: '',
          productName: '',
          colorFinish: '',
          unitPrice: '',
          quantity: '1',
          specSheetUrl: '',
          specSheetFileName: '',
          productUrl: '',
          tags: [],
        });
        setShowAddSelection(false);
        
        // Show success message and redirect
        alert('Selection added successfully!');
        router.push(`/vendor/project/${projectId}`);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to add selection'}`);
      }
    } catch (error) {
      console.error('Error adding selection:', error);
      alert('Failed to add selection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSelection = async () => {
    if (!editingSelection || !room || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/vendor/projects/${projectId}/selections/${editingSelection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSelection,
          unitPrice: newSelection.unitPrice ? parseFloat(newSelection.unitPrice) : null,
          quantity: parseInt(newSelection.quantity),
        }),
      });

      if (response.ok) {
        const updatedSelection = await response.json();
        setRoom(prev => prev ? {
          ...prev,
          selections: prev.selections.map(s => 
            s.id === editingSelection.id ? updatedSelection : s
          )
        } : null);
        setEditingSelection(null);
        setShowAddSelection(false);
        setNewSelection({
          photo: '',
          notes: '',
          vendorName: '',
          productName: '',
          colorFinish: '',
          unitPrice: '',
          quantity: '1',
          specSheetUrl: '',
          specSheetFileName: '',
          productUrl: '',
          tags: [],
        });
        
        // Show success message and redirect
        alert('Selection updated successfully!');
        router.push(`/vendor/project/${projectId}`);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to update selection'}`);
      }
    } catch (error) {
      console.error('Error updating selection:', error);
      alert('Failed to update selection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSelection = async (selectionId: string) => {
    if (!room || !confirm('Are you sure you want to delete this selection?')) return;

    try {
      const response = await fetch(`/api/vendor/projects/${projectId}/selections/${selectionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRoom(prev => prev ? {
          ...prev,
          selections: prev.selections.filter(s => s.id !== selectionId)
        } : null);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to delete selection'}`);
      }
    } catch (error) {
      console.error('Error deleting selection:', error);
      alert('Failed to delete selection. Please try again.');
    }
  };

  const handleCameraCaptureSave = async (selectionData: any) => {
    setNewSelection(prev => ({
      ...prev,
      photo: selectionData.photo,
      vendorName: selectionData.vendorName || '',
      productName: selectionData.productName || '',
      colorFinish: selectionData.colorFinish || '',
      notes: selectionData.notes || '',
      unitPrice: selectionData.unitPrice || '',
      quantity: selectionData.quantity || '1',
    }));
    setShowCameraCapture(false);
  };

  const handlePhotoUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/videos/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setNewSelection(prev => ({ ...prev, photo: data.url }));
        return data.url;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photo');
    }
  };

  const handleSpecSheetUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload-spec-sheet', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setNewSelection(prev => ({ 
          ...prev, 
          specSheetUrl: data.url,
          specSheetFileName: file.name
        }));
        return data.url;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Spec sheet upload error:', error);
      alert(`Failed to upload spec sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAddQuote = async () => {
    if (!quoteForm.content.trim()) return;

    try {
      const formData = new FormData();
      formData.append('type', quoteForm.type);
      formData.append('content', quoteForm.content);
      if (quoteForm.file) {
        formData.append('file', quoteForm.file);
      }
      formData.append('projectId', projectId);
      formData.append('roomId', roomId);

      const response = await fetch('/api/quotes', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setQuoteForm({ type: 'TEXT', content: '', file: null });
        setShowQuoteModal(false);
        // Refresh room data
        fetchRoomData();
      }
    } catch (error) {
      console.error('Error adding quote:', error);
    }
  };

  const startEditing = (selection: Selection) => {
    setEditingSelection(selection);
    setNewSelection({
      photo: selection.photo || '',
      notes: selection.notes || '',
      vendorName: selection.vendorName || '',
      productName: selection.productName || '',
      colorFinish: selection.colorFinish || '',
      unitPrice: selection.unitPrice?.toString() || '',
      quantity: selection.quantity?.toString() || '1',
      specSheetUrl: selection.specSheetUrl || '',
      specSheetFileName: selection.specSheetFileName || '',
      productUrl: selection.productUrl || '',
      tags: selection.tags || [],
    });
    setShowAddSelection(true);
  };

  const cancelEditing = () => {
    setEditingSelection(null);
    setShowAddSelection(false);
    setNewSelection({
      photo: '',
      notes: '',
      vendorName: '',
      productName: '',
      colorFinish: '',
      unitPrice: '',
      quantity: '1',
      specSheetUrl: '',
      specSheetFileName: '',
      productUrl: '',
      tags: [],
    });
  };

  const handleExportRoomSpecs = async () => {
    if (!room || !project) return;

    try {
      // Create a comprehensive export of room specifications
      const exportData = {
        project: {
          name: project.name,
          description: project.description,
          vendorOrgName: project.vendorOrgName,
        },
        room: {
          name: room.name,
          selectionsCount: room.selections.length,
        },
        selections: room.selections.map(selection => ({
          productName: selection.productName,
          vendorName: selection.vendorName,
          colorFinish: selection.colorFinish,
          unitPrice: selection.unitPrice,
          quantity: selection.quantity,
          notes: selection.notes,
          productUrl: selection.productUrl,
          tags: selection.tags,
          specSheetUrl: selection.specSheetUrl,
          specSheetFileName: selection.specSheetFileName,
          createdAt: selection.createdAt,
        })),
        exportDate: new Date().toISOString(),
        exportType: 'room_specifications'
      };

      // Create and download the JSON file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name}-${room.name}-specs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Also create a PDF-like text summary
      const textSummary = `
ROOM SPECIFICATIONS EXPORT
==========================

Project: ${project.name}
Room: ${room.name}
Vendor: ${project.vendorOrgName || 'N/A'}
Export Date: ${new Date().toLocaleDateString()}

SELECTIONS (${room.selections.length})
${'='.repeat(50)}

${room.selections.map((selection, index) => `
${index + 1}. ${selection.productName || 'Unnamed Product'}
   Vendor: ${selection.vendorName || 'N/A'}
   Color/Finish: ${selection.colorFinish || 'N/A'}
   Price: ${selection.unitPrice ? `$${selection.unitPrice}` : 'N/A'}
   Quantity: ${selection.quantity || 1}
   Notes: ${selection.notes || 'N/A'}
   ${selection.specSheetUrl ? `Spec Sheet: ${selection.specSheetFileName || 'Available'}` : ''}
   ${selection.productUrl ? `Product URL: ${selection.productUrl}` : ''}
   ${selection.tags && selection.tags.length > 0 ? `Tags: ${selection.tags.join(', ')}` : ''}
`).join('\n')}

Total Selections: ${room.selections.length}
      `.trim();

      const textBlob = new Blob([textSummary], { type: 'text/plain' });
      const textUrl = URL.createObjectURL(textBlob);
      const textLink = document.createElement('a');
      textLink.href = textUrl;
      textLink.download = `${project.name}-${room.name}-specs-summary-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(textLink);
      textLink.click();
      document.body.removeChild(textLink);
      URL.revokeObjectURL(textUrl);

    } catch (error) {
      console.error('Error exporting room specs:', error);
      alert('Failed to export room specifications');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading room...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check vendor permissions
  if (user && user.role !== 'VENDOR') {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <div className="text-red-500 text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">Only vendors can access this page.</p>
            <button
              onClick={() => router.push('/vendor')}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Back to Vendor Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!room || !project) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-16">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Room Not Found</h2>
              <p className="text-gray-600 mb-6">The room you're looking for doesn't exist or you don't have access to it.</p>
              <button
                onClick={() => router.push(`/vendor/project/${projectId}`)}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Back to Project
              </button>
            </div>
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
                onClick={() => router.push(`/vendor/project/${projectId}`)}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FaArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">{room.name}</h1>
                <p className="text-gray-600">{project.name}</p>
                {project.vendorOrgName && (
                  <p className="text-sm text-gray-500">Organization: {project.vendorOrgName}</p>
                )}
              </div>
            </div>

            {/* Room Actions */}
            <div className="flex flex-wrap gap-4">
              {canEdit() && (
                <>
                  <button
                    onClick={() => setShowAddSelection(true)}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                  >
                    <FaPlus className="w-4 h-4" />
                    Add Selection
                  </button>
                  
                  <button
                    onClick={() => setShowCameraCapture(true)}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                  >
                    <FaCamera className="w-4 h-4" />
                    Camera Capture
                  </button>
                  
                  <button
                    onClick={() => setShowQuoteModal(true)}
                    className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
                  >
                    <FaQuoteLeft className="w-4 h-4" />
                    Add Quote
                  </button>
                </>
              )}
              
              <button
                onClick={handleExportRoomSpecs}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
              >
                <FaDownload className="w-4 h-4" />
                Export Room Specs
              </button>
            </div>
          </motion.div>

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
                className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow relative"
              >
                {/* Spec Sheet Badge */}
                {selection.specSheetUrl && (
                  <div className="absolute top-4 right-4 z-10">
                    <div className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                      <FaFileAlt className="w-3 h-3" />
                      Spec
                    </div>
                  </div>
                )}
                
                {selection.photo && (
                  <img
                    src={selection.photo}
                    alt={selection.productName || 'Product'}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                )}
                
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-gray-900">
                    {selection.productName || 'Unnamed Product'}
                  </h3>
                  
                  {selection.vendorName && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Vendor:</span> {selection.vendorName}
                    </p>
                  )}
                  
                  {selection.colorFinish && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Color/Finish:</span> {selection.colorFinish}
                    </p>
                  )}
                  
                  {selection.unitPrice && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Price:</span> ${selection.unitPrice}
                      {selection.quantity && selection.quantity > 1 && (
                        <span> × {selection.quantity}</span>
                      )}
                    </p>
                  )}
                  
                  {selection.notes && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Notes:</span> {selection.notes}
                    </p>
                  )}
                  
                  {selection.productUrl && (
                    <div className="flex items-center">
                      <FaLink className="w-3 h-3 text-gray-400 mr-1" />
                      <a
                        href={selection.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 truncate"
                      >
                        Product Link
                      </a>
                    </div>
                  )}
                  
                  {selection.tags && selection.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selection.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {selection.specSheetUrl && (
                    <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center">
                        <FaFileAlt className="w-4 h-4 text-blue-600 mr-2" />
                        <span className="text-sm text-blue-800">
                          {selection.specSheetFileName || 'Spec Sheet'}
                        </span>
                      </div>
                      <a
                        href={selection.specSheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </a>
                    </div>
                  )}
                  
                  {canEdit() && (
                    <div className="flex space-x-2 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => startEditing(selection)}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                      >
                        <FaEdit className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSelection(selection.id)}
                        className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                      >
                        <FaTrash className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  )}
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
                <FaTag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Selections Yet</h3>
                <p className="text-gray-600 mb-6">
                  Start adding product selections to this room
                </p>
                {canEdit() && (
                  <button
                    onClick={() => setShowAddSelection(true)}
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Add Your First Selection
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Add/Edit Selection Modal */}
      {showAddSelection && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingSelection ? 'Edit Selection' : 'Add Selection'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={newSelection.productName}
                  onChange={(e) => setNewSelection(prev => ({ ...prev, productName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter product name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product URL
                </label>
                <input
                  type="url"
                  value={newSelection.productUrl}
                  onChange={(e) => setNewSelection(prev => ({ ...prev, productUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/product"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name
                </label>
                <input
                  type="text"
                  value={newSelection.vendorName}
                  onChange={(e) => setNewSelection(prev => ({ ...prev, vendorName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter vendor name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color/Finish
                </label>
                <input
                  type="text"
                  value={newSelection.colorFinish}
                  onChange={(e) => setNewSelection(prev => ({ ...prev, colorFinish: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter color or finish"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Price
                  </label>
                  <input
                    type="number"
                    value={newSelection.unitPrice}
                    onChange={(e) => setNewSelection(prev => ({ ...prev, unitPrice: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={newSelection.quantity}
                    onChange={(e) => setNewSelection(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={newSelection.notes}
                  onChange={(e) => setNewSelection(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Add notes about this selection"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Photo
                </label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowCameraCapture(true)}
                    className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <FaCamera className="mr-2" />
                    Camera
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <FaFileUpload className="mr-2" />
                    Upload
                  </button>
                </div>
                {newSelection.photo && (
                  <img
                    src={newSelection.photo}
                    alt="Selected"
                    className="mt-2 w-full h-32 object-cover rounded-lg"
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={newSelection.tags.join(', ')}
                  onChange={(e) => setNewSelection(prev => ({ 
                    ...prev, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="modern, luxury, sustainable"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Spec Sheet
                </label>
                <div className="flex space-x-2">
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleSpecSheetUpload(file);
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {newSelection.specSheetUrl && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FaFileAlt className="w-4 h-4 text-green-600 mr-2" />
                        <span className="text-sm text-green-800">
                          {newSelection.specSheetFileName || 'Spec Sheet Uploaded'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <a
                          href={newSelection.specSheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          View
                        </a>
                        <button
                          onClick={() => setNewSelection(prev => ({ 
                            ...prev, 
                            specSheetUrl: '', 
                            specSheetFileName: '' 
                          }))}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={editingSelection ? handleUpdateSelection : handleAddSelection}
                disabled={isSubmitting}
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {editingSelection ? 'Updating...' : 'Adding...'}
                  </>
                ) : (
                  `${editingSelection ? 'Update' : 'Add'} Selection`
                )}
              </button>
              <button
                onClick={cancelEditing}
                disabled={isSubmitting}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Add Quote Modal */}
      {showQuoteModal && (
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
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Quote</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quote Type
                </label>
                <select
                  value={quoteForm.type}
                  onChange={(e) => setQuoteForm(prev => ({ ...prev, type: e.target.value as 'PDF' | 'IMAGE' | 'TEXT' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="TEXT">Text Note</option>
                  <option value="IMAGE">Image</option>
                  <option value="PDF">PDF Document</option>
                </select>
              </div>
              {quoteForm.type === 'TEXT' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quote Content
                  </label>
                  <textarea
                    value={quoteForm.content}
                    onChange={(e) => setQuoteForm(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Enter quote details..."
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload File
                  </label>
                  <input
                    type="file"
                    accept={quoteForm.type === 'PDF' ? '.pdf' : 'image/*'}
                    onChange={(e) => setQuoteForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddQuote}
                className="flex-1 bg-purple-500 text-white py-2 px-4 rounded-lg hover:bg-purple-600 transition-colors"
              >
                Add Quote
              </button>
              <button
                onClick={() => {
                  setShowQuoteModal(false);
                  setQuoteForm({ type: 'TEXT', content: '', file: null });
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Camera Capture Modal */}
      <CameraCapture
        isOpen={showCameraCapture}
        onClose={() => setShowCameraCapture(false)}
        onSave={handleCameraCaptureSave}
        currentProjectId={projectId}
        currentRoomId={roomId}
        projects={projects}
        rooms={project ? [room] : []}
      />

      {/* File Upload Modal */}
      {showUploadModal && (
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
            <h3 className="text-xl font-bold text-gray-900 mb-4">Upload Photo</h3>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const photoUrl = await handlePhotoUpload(file);
                  if (photoUrl) {
                    setNewSelection(prev => ({ ...prev, photo: photoUrl }));
                  }
                }
                setShowUploadModal(false);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
} 