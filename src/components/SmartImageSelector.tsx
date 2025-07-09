'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaImage, FaCheck, FaSpinner, FaMagic } from 'react-icons/fa';

interface SmartImageSelectorProps {
  type: 'event' | 'vendor' | 'product';
  name: string;
  description?: string;
  location?: string;
  category?: string;
  brand?: string;
  onImageSelect: (imageUrl: string, imageType: string) => void;
  className?: string;
}

interface ImageResult {
  url: string;
  title: string;
  width: number;
  height: number;
  source: string;
}

export default function SmartImageSelector({
  type,
  name,
  description,
  location,
  category,
  brand,
  onImageSelect,
  className = ''
}: SmartImageSelectorProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchImages = async () => {
    if (!name.trim()) {
      setError('Please provide a name to search for images');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch('/api/smart-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          name,
          description,
          location,
          category,
          brand
        }),
      });

      const data = await response.json();

      if (data.success) {
        setImages(data.images);
        setShowResults(true);
      } else {
        setError(data.error || 'Failed to search images');
      }
    } catch (error) {
      console.error('Smart image search failed:', error);
      setError('Failed to search images. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleImageSelect = (image: ImageResult, imageType: string) => {
    onImageSelect(image.url, imageType);
    setShowResults(false);
  };

  const getImageTypeLabel = (image: ImageResult) => {
    if (type === 'vendor') {
      if (image.width === image.height || image.title.toLowerCase().includes('logo')) {
        return 'Logo';
      }
      if (image.width > image.height && image.width >= 1200) {
        return 'Banner';
      }
    }
    
    if (type === 'event') {
      if (image.width >= 1200) {
        return 'Banner';
      }
      return 'Thumbnail';
    }
    
    return 'Image';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={searchImages}
          disabled={isSearching || !name.trim()}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSearching ? (
            <>
              <FaSpinner className="animate-spin mr-2" />
              Searching...
            </>
          ) : (
            <>
              <FaMagic className="mr-2" />
              Find Smart Images
            </>
          )}
        </button>
        
        <span className="text-sm text-gray-600">
          AI-powered image search for {type}
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Smart Image Results
              </h3>
              <button
                onClick={() => setShowResults(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {images.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No images found. Try adjusting your search terms.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((image, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="group relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <img
                      src={image.url}
                      alt={image.title}
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://source.unsplash.com/random/300x200?placeholder';
                      }}
                    />
                    
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 space-y-2">
                        <div className="text-center">
                          <p className="text-white text-sm font-medium">
                            {getImageTypeLabel(image)}
                          </p>
                          <p className="text-white text-xs opacity-75">
                            {image.width}×{image.height}
                          </p>
                        </div>
                        
                        <div className="flex gap-2 justify-center">
                          {type === 'vendor' && (
                            <>
                              <button
                                onClick={() => handleImageSelect(image, 'logo')}
                                className="px-3 py-1 bg-white text-black text-xs rounded hover:bg-gray-100 transition-colors"
                              >
                                Use as Logo
                              </button>
                              <button
                                onClick={() => handleImageSelect(image, 'banner')}
                                className="px-3 py-1 bg-white text-black text-xs rounded hover:bg-gray-100 transition-colors"
                              >
                                Use as Banner
                              </button>
                            </>
                          )}
                          
                          {type === 'event' && (
                            <>
                              <button
                                onClick={() => handleImageSelect(image, 'banner')}
                                className="px-3 py-1 bg-white text-black text-xs rounded hover:bg-gray-100 transition-colors"
                              >
                                Use as Banner
                              </button>
                              <button
                                onClick={() => handleImageSelect(image, 'thumbnail')}
                                className="px-3 py-1 bg-white text-black text-xs rounded hover:bg-gray-100 transition-colors"
                              >
                                Use as Thumbnail
                              </button>
                            </>
                          )}
                          
                          {type === 'product' && (
                            <button
                              onClick={() => handleImageSelect(image, 'imageUrl')}
                              className="px-3 py-1 bg-white text-black text-xs rounded hover:bg-gray-100 transition-colors"
                            >
                              Use as Product Image
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                      {image.source}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 