'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaLink, FaSpinner, FaCheck, FaTimes, FaEdit, FaImage, FaTag, FaDollarSign } from 'react-icons/fa';

interface ScrapedProductData {
  name: string;
  price: string;
  image: string;
  description: string;
  brand: string;
  category: string;
  tags: string[];
  materials: string[];
  dimensions: string;
  colors: string[];
}

interface ProductUploaderProps {
  onProductAdded: (product: any) => void;
  onClose: () => void;
}

export default function ProductUploader({ onProductAdded, onClose }: ProductUploaderProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedProductData | null>(null);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);

  // Form state for manual editing
  const [formData, setFormData] = useState<ScrapedProductData>({
    name: '',
    price: '',
    image: '',
    description: '',
    brand: '',
    category: '',
    tags: [],
    materials: [],
    dimensions: '',
    colors: []
  });

  const handleUrlScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/scrape-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape product data');
      }

      setScrapedData(data);
      setFormData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch product data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create product object
    const newProduct = {
      id: `product-${Date.now()}`,
      name: formData.name,
      brand: formData.brand,
      price: formData.price,
      image: formData.image,
      description: formData.description,
      category: formData.category,
      tags: formData.tags,
      materials: formData.materials,
      dimensions: formData.dimensions,
      colors: formData.colors,
      sourceUrl: url,
      vendorId: 'current-vendor',
      dateAdded: new Date().toISOString()
    };

    onProductAdded(newProduct);
    
    // Reset form
    setUrl('');
    setScrapedData(null);
    setFormData({
      name: '', price: '', image: '', description: '', brand: '', category: '',
      tags: [], materials: [], dimensions: '', colors: []
    });
    
    alert('Product added successfully!');
  };

  const updateFormField = (field: keyof ScrapedProductData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      updateFormField('tags', [...formData.tags, tag.trim()]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateFormField('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Add New Product</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>

          {/* URL Input Section */}
          {!scrapedData && (
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Product URL
              </label>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <FaLink className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/product-page"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={handleUrlScrape}
                  disabled={isLoading || !url.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <FaCheck />
                      Fetch Data
                    </>
                  )}
                </button>
              </div>
              
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-600 text-sm mt-2 flex items-center gap-2"
                >
                  <FaTimes className="w-4 h-4" />
                  {error}
                </motion.p>
              )}

              <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                <h4 className="font-medium text-blue-900 mb-2">Supported Sites:</h4>
                <p className="text-sm text-blue-700">
                  Most major furniture and decor retailers (West Elm, CB2, Wayfair, etc.). 
                  We'll extract product name, price, images, and description automatically.
                </p>
              </div>
            </div>
          )}

          {/* Product Form */}
          <AnimatePresence>
            {scrapedData && (
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* Success Message */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3"
                >
                  <FaCheck className="text-green-600" />
                  <div>
                    <h4 className="font-medium text-green-900">Product data fetched successfully!</h4>
                    <p className="text-sm text-green-700">Review and edit the information below, then submit.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditMode(!editMode)}
                    className="ml-auto text-green-600 hover:text-green-800 transition-colors"
                  >
                    <FaEdit />
                  </button>
                </motion.div>

                {/* Product Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Image and Basic Info */}
                  <div className="space-y-4">
                    {/* Product Image */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Image
                      </label>
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                        {formData.image ? (
                          <img
                            src={formData.image}
                            alt={formData.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <FaImage className="w-12 h-12" />
                          </div>
                        )}
                      </div>
                      {editMode && (
                        <input
                          type="url"
                          value={formData.image}
                          onChange={(e) => updateFormField('image', e.target.value)}
                          placeholder="Image URL"
                          className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      )}
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-4">
                      {/* Product Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Product Name
                        </label>
                        {editMode ? (
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => updateFormField('name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        ) : (
                          <p className="text-lg font-semibold text-gray-900">{formData.name}</p>
                        )}
                      </div>

                      {/* Price */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Price
                        </label>
                        {editMode ? (
                          <div className="relative">
                            <FaDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={formData.price}
                              onChange={(e) => updateFormField('price', e.target.value)}
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="$0.00"
                            />
                          </div>
                        ) : (
                          <p className="text-xl font-bold text-blue-600">{formData.price}</p>
                        )}
                      </div>

                      {/* Brand */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Brand
                        </label>
                        {editMode ? (
                          <input
                            type="text"
                            value={formData.brand}
                            onChange={(e) => updateFormField('brand', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-gray-700">{formData.brand}</p>
                        )}
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Category
                        </label>
                        {editMode ? (
                          <select
                            value={formData.category}
                            onChange={(e) => updateFormField('category', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select Category</option>
                            <option value="Furniture">Furniture</option>
                            <option value="Lighting">Lighting</option>
                            <option value="Decor">Decor</option>
                            <option value="Textiles">Textiles</option>
                            <option value="Storage">Storage</option>
                            <option value="Art">Art</option>
                          </select>
                        ) : (
                          <p className="text-gray-700">{formData.category}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Details */}
                  <div className="space-y-4">
                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      {editMode ? (
                        <textarea
                          value={formData.description}
                          onChange={(e) => updateFormField('description', e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                      ) : (
                        <p className="text-gray-700 text-sm leading-relaxed">{formData.description}</p>
                      )}
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tags
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {formData.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                          >
                            <FaTag className="w-3 h-3" />
                            {tag}
                            {editMode && (
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="ml-1 text-blue-600 hover:text-blue-800"
                              >
                                <FaTimes className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      {editMode && (
                        <input
                          type="text"
                          placeholder="Add tag and press Enter"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTag(e.currentTarget.value);
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                      )}
                    </div>

                    {/* Dimensions */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dimensions
                      </label>
                      {editMode ? (
                        <input
                          type="text"
                          value={formData.dimensions}
                          onChange={(e) => updateFormField('dimensions', e.target.value)}
                          placeholder="e.g., 84&quot;W x 36&quot;D x 32&quot;H"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-700">{formData.dimensions || 'Not specified'}</p>
                      )}
                    </div>

                    {/* Materials */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Materials
                      </label>
                      {editMode ? (
                        <input
                          type="text"
                          value={formData.materials.join(', ')}
                          onChange={(e) => updateFormField('materials', e.target.value.split(',').map(m => m.trim()))}
                          placeholder="e.g., Solid wood, Steel, Fabric"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-700">{formData.materials.join(', ') || 'Not specified'}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setScrapedData(null);
                      setFormData({
                        name: '', price: '', image: '', description: '', brand: '', category: '',
                        tags: [], materials: [], dimensions: '', colors: []
                      });
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Start Over
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-medium flex items-center justify-center gap-2"
                  >
                    <FaCheck />
                    Add Product to Catalog
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
} 