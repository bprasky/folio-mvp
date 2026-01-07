'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaCamera, FaUpload, FaTimes, FaMapMarkerAlt, FaTag, 
  FaPalette, FaStickyNote, FaSave, FaArrowLeft, FaHome 
} from 'react-icons/fa';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectionData: SelectionData) => void;
  currentProjectId?: string;
  currentRoomId?: string;
  projects?: Project[];
  rooms?: Room[];
  preloadedImage?: string;
  isProjectLevel?: boolean; // New prop to indicate if this is project-level selection
}

interface SelectionData {
  photo: string;
  vendorName?: string; // Optional until schema is updated
  productName?: string; // Optional until schema is updated
  colorFinish?: string; // Optional until schema is updated
  notes: string;
  phaseOfUse?: string; // Optional until schema is updated
  gpsLocation?: string;
  source: 'camera' | 'upload';
  projectId: string;
  roomId?: string; // Optional for project-level selections
}

interface Project {
  id: string;
  name: string;
  rooms: Room[];
}

interface Room {
  id: string;
  name: string;
}

const PHASE_OPTIONS = [
  { value: 'moodboard', label: 'Moodboard / Inspiration' },
  { value: 'final_spec', label: 'Final Specification' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' }
];

export default function CameraCapture({
  isOpen,
  onClose,
  onSave,
  currentProjectId,
  currentRoomId,
  projects = [],
  rooms = [],
  preloadedImage,
  isProjectLevel = false
}: CameraCaptureProps) {
  const [step, setStep] = useState<'capture' | 'specify' | 'assign'>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState(currentProjectId || '');
  const [selectedRoomId, setSelectedRoomId] = useState(currentRoomId || '');
  const [newRoomName, setNewRoomName] = useState('');
  const [showNewRoomInput, setShowNewRoomInput] = useState(false);
  
  const [formData, setFormData] = useState({
    vendorName: '',
    productName: '',
    colorFinish: '',
    notes: '',
    phaseOfUse: 'moodboard'
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Get available rooms for selected project
  const availableRooms = projects.find(p => p.id === selectedProjectId)?.rooms || [];

  // Handle preloaded image and context-aware initialization
  useEffect(() => {
    if (isOpen) {
      if (preloadedImage) {
        setCapturedImage(preloadedImage);
        setStep('specify');
      } else {
        setStep('capture');
        setCapturedImage(null);
      }
      
      // Set context-aware defaults
      setSelectedProjectId(currentProjectId || '');
      setSelectedRoomId(currentRoomId || '');
      
      // If we have both project and room context, skip assignment step
      if (currentProjectId && currentRoomId && !isProjectLevel) {
        // Room-level workflow - will skip assignment step
      } else if (currentProjectId && isProjectLevel) {
        // Project-level workflow - will show room assignment
      }
    }
  }, [isOpen, preloadedImage, currentProjectId, currentRoomId, isProjectLevel]);

  const startCamera = useCallback(async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }

      // Get GPS location if available
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setGpsLocation(`${latitude},${longitude}`);
          },
          (error) => {
            console.log('GPS not available:', error);
          }
        );
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please use file upload instead.');
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        stopCamera();
        setStep('specify');
      }
    }
  }, [stopCamera]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setCapturedImage(result);
        setStep('specify');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    if (step === 'capture' && capturedImage) {
      setStep('specify');
    } else if (step === 'specify') {
      // Check if we need assignment step
      if (currentProjectId && currentRoomId && !isProjectLevel) {
        // Room-level workflow - skip assignment, go directly to save
        handleSave();
      } else {
        // Project-level workflow or missing context - show assignment
        setStep('assign');
      }
    } else if (step === 'assign') {
      handleSave();
    }
  };

  const handleBack = () => {
    if (step === 'specify') {
      setStep('capture');
      setCapturedImage(null);
    } else if (step === 'assign') {
      setStep('specify');
    }
  };

  const handleSave = async () => {
    if (!capturedImage || !selectedProjectId) {
      alert('Please complete all required fields');
      return;
    }

    // For room-level workflow, roomId is required
    if (!isProjectLevel && !selectedRoomId) {
      alert('Please select a room');
      return;
    }

    // Create selection data compatible with current schema
    const selectionData: SelectionData = {
      photo: capturedImage,
      notes: formData.notes || 'No notes provided',
      gpsLocation: gpsLocation || undefined,
      source: 'camera',
      projectId: selectedProjectId,
      roomId: selectedRoomId || undefined // Optional for project-level
    };

    // Add optional fields if they have values (will be stored in notes for now)
    const additionalInfo = [];
    if (formData.vendorName) additionalInfo.push(`Vendor: ${formData.vendorName}`);
    if (formData.productName) additionalInfo.push(`Product: ${formData.productName}`);
    if (formData.colorFinish) additionalInfo.push(`Color/Finish: ${formData.colorFinish}`);
    if (formData.phaseOfUse) additionalInfo.push(`Phase: ${formData.phaseOfUse}`);

    if (additionalInfo.length > 0) {
      selectionData.notes = `${selectionData.notes}\n\n${additionalInfo.join('\n')}`;
    }

    onSave(selectionData);
    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setStep('capture');
    setFormData({
      vendorName: '',
      productName: '',
      colorFinish: '',
      notes: '',
      phaseOfUse: 'moodboard'
    });
    setSelectedProjectId(currentProjectId || '');
    setSelectedRoomId(currentRoomId || '');
    setNewRoomName('');
    setShowNewRoomInput(false);
    setGpsLocation(null);
    onClose();
  };

  const createNewRoom = async () => {
    if (!newRoomName.trim() || !selectedProjectId) return;

    try {
      const response = await fetch(`/api/designer/projects/${selectedProjectId}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newRoomName.trim() }),
      });

      if (response.ok) {
        const newRoom = await response.json();
        setSelectedRoomId(newRoom.id);
        setShowNewRoomInput(false);
        setNewRoomName('');
        // Refresh rooms list
        window.location.reload();
      } else {
        alert('Failed to create room');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FaArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold text-gray-900">
                {step === 'capture' && 'Capture Material'}
                {step === 'specify' && 'Product Specification'}
                {step === 'assign' && (isProjectLevel ? 'Assign to Room' : 'Assign to Project')}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {/* Step 1: Camera Capture */}
            {step === 'capture' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <p className="text-gray-600 mb-6">
                    Capture product photos during showroom visits or upload existing images
                  </p>
                </div>

                {/* Camera Interface */}
                <div className="space-y-4">
                  <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    {!capturedImage ? (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        <canvas
                          ref={canvasRef}
                          className="hidden"
                        />
                        {!isCapturing && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <FaCamera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-600">Camera not active</p>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <img
                        src={capturedImage}
                        alt="Captured"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Camera Controls */}
                  <div className="flex gap-4 justify-center">
                    {!capturedImage ? (
                      <>
                        <button
                          onClick={startCamera}
                          disabled={isCapturing}
                          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          <FaCamera className="w-4 h-4" />
                          {isCapturing ? 'Starting Camera...' : 'Start Camera'}
                        </button>
                        <label className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2 cursor-pointer">
                          <FaUpload className="w-4 h-4" />
                          Upload Photo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </>
                    ) : (
                      <button
                        onClick={() => setCapturedImage(null)}
                        className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors"
                      >
                        Retake Photo
                      </button>
                    )}
                  </div>
                </div>

                {capturedImage && (
                  <div className="text-center">
                    <button
                      onClick={handleNext}
                      className="bg-green-500 text-white px-8 py-3 rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Continue to Specification
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Product Specification */}
            {step === 'specify' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {capturedImage && (
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-6">
                    <img
                      src={capturedImage}
                      alt="Captured"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Vendor Information */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vendor Name *
                    </label>
                    <input
                      type="text"
                      value={formData.vendorName}
                      onChange={(e) => handleInputChange('vendorName', e.target.value)}
                      placeholder="Enter vendor name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={formData.productName}
                      onChange={(e) => handleInputChange('productName', e.target.value)}
                      placeholder="Enter product name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color/Finish
                    </label>
                    <input
                      type="text"
                      value={formData.colorFinish}
                      onChange={(e) => handleInputChange('colorFinish', e.target.value)}
                      placeholder="e.g., Matte Black, Natural Oak"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phase of Use
                    </label>
                    <select
                      value={formData.phaseOfUse}
                      onChange={(e) => handleInputChange('phaseOfUse', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {PHASE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes & Application Context
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Describe application, install ideas, room context (e.g., 'Perfect for guest bathroom vanity')"
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {gpsLocation && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FaMapMarkerAlt className="w-4 h-4" />
                    <span>Location captured: {gpsLocation}</span>
                  </div>
                )}

                <div className="flex gap-4 justify-end">
                  <button
                    onClick={handleBack}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!formData.vendorName || !formData.productName}
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {currentProjectId && currentRoomId && !isProjectLevel ? 'Save Selection' : 'Continue to Assignment'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Project Assignment - Only show for project-level or missing context */}
            {step === 'assign' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {isProjectLevel ? 'Assign to Room' : 'Assign to Project & Room'}
                  </h3>
                  <p className="text-gray-600">
                    {isProjectLevel 
                      ? 'Choose which room to assign this selection to, or leave as general project inspiration'
                      : 'Choose where to save this material selection'
                    }
                  </p>
                </div>

                {/* Project Selection - Only show if not already in project context */}
                {!currentProjectId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project *
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => {
                        setSelectedProjectId(e.target.value);
                        setSelectedRoomId(''); // Reset room when project changes
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select a project</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Room Selection */}
                {(selectedProjectId || currentProjectId) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room {isProjectLevel ? '(Optional)' : '*'}
                    </label>
                    <div className="space-y-3">
                      <select
                        value={selectedRoomId}
                        onChange={(e) => setSelectedRoomId(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required={!isProjectLevel}
                      >
                        <option value="">
                          {isProjectLevel ? 'Leave as General Project Inspiration' : 'Select a room'}
                        </option>
                        {availableRooms.map(room => (
                          <option key={room.id} value={room.id}>
                            {room.name}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => setShowNewRoomInput(true)}
                        className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-2"
                      >
                        <FaHome className="w-4 h-4" />
                        Create new room
                      </button>

                      {showNewRoomInput && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            placeholder="Enter room name"
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            onClick={createNewRoom}
                            disabled={!newRoomName.trim()}
                            className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                          >
                            Create
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 justify-end">
                  <button
                    onClick={handleBack}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!selectedProjectId || (!isProjectLevel && !selectedRoomId)}
                    className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <FaSave className="w-4 h-4" />
                    Save Selection
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 