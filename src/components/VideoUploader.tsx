'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUpload, FaVideo, FaLink, FaTimes, FaCheck, 
  FaSpinner, FaPlay, FaTag, FaGlobe, FaLock,
  FaFolder, FaYoutube, FaVimeo
} from 'react-icons/fa';

interface VideoUploaderProps {
  creatorId: string;
  creatorType: 'designer' | 'vendor';
  onUploadComplete?: (video: any) => void;
  onClose?: () => void;
  projects?: any[];
}

export default function VideoUploader({ 
  creatorId, 
  creatorType, 
  onUploadComplete, 
  onClose,
  projects = []
}: VideoUploaderProps) {
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [relatedProjectId, setRelatedProjectId] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<'idle' | 'processing' | 'completed'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));
    
    if (videoFile) {
      setVideoFile(videoFile);
      if (!title) {
        setTitle(videoFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const detectVideoType = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    }
    if (url.includes('vimeo.com')) {
      return 'vimeo';
    }
    return 'direct';
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      alert('Please enter a title for your video');
      return;
    }

    if (uploadMethod === 'file' && !videoFile) {
      alert('Please select a video file');
      return;
    }

    if (uploadMethod === 'url' && !videoUrl.trim()) {
      alert('Please enter a video URL');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setTranscriptionStatus('processing');

    try {
      const formData = new FormData();
      
      if (uploadMethod === 'file' && videoFile) {
        formData.append('video', videoFile);
      } else {
        formData.append('videoUrl', videoUrl);
      }
      
      formData.append('title', title);
      formData.append('description', description);
      formData.append('creatorId', creatorId);
      formData.append('creatorType', creatorType);
      formData.append('tags', tags);
      formData.append('relatedProjectId', relatedProjectId);
      formData.append('isPublic', isPublic.toString());

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/videos/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      if (result.success) {
        setUploadComplete(true);
        setTranscriptionStatus('completed');
        
        // Wait a moment then call completion callback
        setTimeout(() => {
          onUploadComplete?.(result.video);
          onClose?.();
        }, 2000);
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
      setTranscriptionStatus('idle');
    } finally {
      setIsUploading(false);
    }
  };

  const getVideoTypeIcon = () => {
    if (uploadMethod === 'url') {
      const type = detectVideoType(videoUrl);
      switch (type) {
        case 'youtube':
          return <FaYoutube className="text-red-500" />;
        case 'vimeo':
          return <FaVimeo className="text-blue-500" />;
        default:
          return <FaLink className="text-gray-500" />;
      }
    }
    return <FaVideo className="text-blue-500" />;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Upload Video</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaTimes className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Upload Method Selection */}
          <div className="flex gap-4">
            <button
              onClick={() => setUploadMethod('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                uploadMethod === 'file'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <FaUpload className="w-5 h-5" />
              Upload File
            </button>
            <button
              onClick={() => setUploadMethod('url')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                uploadMethod === 'url'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <FaLink className="w-5 h-5" />
              Video URL
            </button>
          </div>

          {/* File Upload Area */}
          {uploadMethod === 'file' && (
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : videoFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {videoFile ? (
                <div className="space-y-3">
                  <FaCheck className="w-12 h-12 text-green-500 mx-auto" />
                  <p className="text-green-700 font-medium">{videoFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <button
                    onClick={() => setVideoFile(null)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <FaVideo className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-gray-700 font-medium">
                      Drag and drop your video here
                    </p>
                    <p className="text-sm text-gray-500">or</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      browse files
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Supports MP4, MOV, AVI (max 100MB)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* URL Input */}
          {uploadMethod === 'url' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Video URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {getVideoTypeIcon()}
                </div>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or direct video URL"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500">
                Supports YouTube, Vimeo, or direct video URLs
              </p>
            </div>
          )}

          {/* Video Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your video content"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="relative">
                <FaTag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="design, modern, kitchen (comma separated)"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Project Association */}
            {projects.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Related Project (Optional)
                </label>
                <div className="relative">
                  <FaFolder className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <select
                    value={relatedProjectId}
                    onChange={(e) => setRelatedProjectId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Visibility
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsPublic(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                    isPublic
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <FaGlobe className="w-4 h-4" />
                  Public
                </button>
                <button
                  onClick={() => setIsPublic(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                    !isPublic
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <FaLock className="w-4 h-4" />
                  Private
                </button>
              </div>
            </div>
          </div>

          {/* Upload Progress */}
          <AnimatePresence>
            {isUploading && (
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Uploading...</span>
                  <span className="text-gray-900 font-medium">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="bg-blue-600 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                
                {transcriptionStatus === 'processing' && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    AI transcription in progress...
                  </div>
                )}
              </motion.div>
            )}

            {uploadComplete && (
              <motion.div
                className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-xl"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <FaCheck className="w-5 h-5" />
                <span className="font-medium">Upload completed successfully!</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading || uploadComplete || !title.trim() || (uploadMethod === 'file' && !videoFile) || (uploadMethod === 'url' && !videoUrl.trim())}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : uploadComplete ? (
                <>
                  <FaCheck className="w-4 h-4" />
                  Complete
                </>
              ) : (
                <>
                  <FaUpload className="w-4 h-4" />
                  Upload Video
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
} 