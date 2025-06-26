'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaTag, FaImage, FaUpload, FaCheck } from 'react-icons/fa';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import AdvancedTagProducts from '@/components/AdvancedTagProducts';

const demoImages = [
  {
    id: 'project-1',
    name: 'Modern Living Room',
    url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop',
    description: 'Contemporary living space with clean lines and natural lighting'
  },
  {
    id: 'project-2', 
    name: 'Scandinavian Kitchen',
    url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
    description: 'Minimalist kitchen design with wooden accents'
  },
  {
    id: 'project-3',
    name: 'Industrial Bedroom',
    url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop',
    description: 'Modern bedroom with industrial elements and urban views'
  },
  {
    id: 'project-4',
    name: 'Luxury Bathroom',
    url: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800&h=600&fit=crop',
    description: 'Spa-like bathroom with marble finishes and elegant fixtures'
  }
];

export default function ProjectTaggingDemo() {
  const [selectedImage, setSelectedImage] = useState(demoImages[0]);
  const [tags, setTags] = useState<any[]>([]);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleTagsUpdate = (updatedTags: any[]) => {
    setTags(updatedTags);
  };

  const handleCustomImageSubmit = () => {
    if (customImageUrl.trim()) {
      const customImage = {
        id: 'custom-' + Date.now(),
        name: 'Custom Project Image',
        url: customImageUrl.trim(),
        description: 'Custom uploaded project image'
      };
      setSelectedImage(customImage);
      setTags([]);
      setShowCustomInput(false);
      setCustomImageUrl('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Navigation */}
      <Navigation />
      
      {/* Main Content */}
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link 
              href="/designer" 
              className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4 transition-colors"
            >
              <FaArrowLeft className="w-4 h-4 mr-2" />
              Back to Designer Dashboard
            </Link>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Advanced Product Tagging
                </h1>
                <p className="text-gray-600 text-lg">
                  Click on any part of your project images to tag products from our vendor catalog
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{tags.length}</div>
                  <div className="text-sm text-gray-500">Products Tagged</div>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <FaTag className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Image Selection */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Select Project Image</h2>
              <button
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaUpload className="w-4 h-4" />
                Use Custom Image
              </button>
            </div>

            {/* Custom Image Input */}
            {showCustomInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-4 bg-white rounded-lg border border-gray-200"
              >
                <div className="flex gap-3">
                  <input
                    type="url"
                    placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleCustomImageSubmit}
                    disabled={!customImageUrl.trim()}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <FaCheck className="w-4 h-4" />
                    Use Image
                  </button>
                </div>
              </motion.div>
            )}

            {/* Demo Images Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {demoImages.map((image) => (
                <motion.div
                  key={image.id}
                  className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-200 ${
                    selectedImage.id === image.id
                      ? 'border-blue-500 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedImage(image);
                    setTags([]);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="aspect-video bg-gray-100">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">{image.name}</h3>
                    <p className="text-gray-600 text-xs">{image.description}</p>
                  </div>
                  
                  {selectedImage.id === image.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center">
                      <FaCheck className="w-3 h-3" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Main Tagging Interface */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Tag Products in: {selectedImage.name}
              </h2>
              <p className="text-gray-600">
                Click anywhere on the image below to tag products from our vendor catalog. 
                Hover over existing tags to see product details.
              </p>
            </div>

            {/* Advanced Tagging Component */}
            <AdvancedTagProducts
              imageUrl={selectedImage.url}
              projectId={selectedImage.id}
              onTagsUpdate={handleTagsUpdate}
              isEditable={true}
            />
          </div>

          {/* Instructions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <FaImage className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">1. Select Image</h3>
              <p className="text-gray-600 text-sm">
                Choose from our demo images or upload your own project image using a URL.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <FaTag className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">2. Click to Tag</h3>
              <p className="text-gray-600 text-sm">
                Click on any furniture, decor, or fixture in the image to tag it with a product from our catalog.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <FaCheck className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">3. Save & Share</h3>
              <p className="text-gray-600 text-sm">
                Tagged products are automatically saved and can be shared with clients or used for analytics.
              </p>
            </div>
          </div>

          {/* Features Highlight */}
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">✨ Advanced Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Smart Product Search:</strong> Find products by name, brand, category, or tags
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Precise Positioning:</strong> Percentage-based coordinates for responsive tagging
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Interactive Tooltips:</strong> Hover over tags to see product details instantly
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Tag Management:</strong> Easy deletion and editing of existing tags
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 