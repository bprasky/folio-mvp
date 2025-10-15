'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { FaTimes, FaPlus, FaUpload, FaLink, FaTag, FaTrash, FaSearch, FaCheck, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';

interface ProjectImage {
  id: string;
  url: string;
  name: string;
  room: string;
  tags: ProductTag[];
}

interface ProductTag {
  id: string;
  x: number;
  y: number;
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  productBrand: string;
  isPending?: boolean;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number | string;
  image: string;
  category: string;
  tags: string[];
  isPending?: boolean;
}

interface ProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: any) => void;
  editingProject?: any;
}

const ProjectCreationModal: React.FC<ProjectCreationModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
  editingProject
}) => {
  const [currentStep, setCurrentStep] = useState<'details' | 'images' | 'tagging'>('details');
  const [projectName, setProjectName] = useState('');
  const [projectClient, setProjectClient] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectCategory, setProjectCategory] = useState('');
  const [selectedDesigner, setSelectedDesigner] = useState('');
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [pendingTag, setPendingTag] = useState<{ x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  
  // New state for URL-based product addition
  const [showAddProductTab, setShowAddProductTab] = useState(false);
  const [productUrl, setProductUrl] = useState('');
  const [isScrapingProduct, setIsScrapingProduct] = useState(false);
  const [scrapedProduct, setScrapedProduct] = useState<any>(null);
  const [scrapingError, setScrapingError] = useState('');

  // Error handling and draft saving state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());
  const [imageLoadingStates, setImageLoadingStates] = useState<Set<string>>(new Set());
  const [draftSaved, setDraftSaved] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with editing project data
  useEffect(() => {
    if (editingProject && isOpen) {
      setProjectName(editingProject.name || '');
      setProjectClient(editingProject.client || '');
      setProjectDescription(editingProject.description || '');
      setProjectCategory(editingProject.category || '');
      setSelectedDesigner(editingProject.designerId || '');
      setImages(editingProject.images || []);
      setCurrentStep('details');
    } else if (!editingProject && isOpen) {
      // Reset form for new project
      setProjectName('');
      setProjectClient('');
      setProjectDescription('');
      setProjectCategory('');
      setSelectedDesigner('');
      setImages([]);
      setCurrentStep('details');
    }
  }, [editingProject, isOpen]);

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      // API returns products directly as an array, not wrapped in an object
      const productsArray = Array.isArray(data) ? data : [];
      setProducts(productsArray);
      setFilteredProducts(productsArray);
    } catch (error) {
      console.error('Failed to load products:', error);
      // Ensure we always have an array even if the API fails
      setProducts([]);
      setFilteredProducts([]);
    }
  }, []);

  const handleProductSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredProducts(products || []);
      return;
    }

    const filtered = (products || []).filter(product =>
      product.name.toLowerCase().includes(query.toLowerCase()) ||
      product.brand.toLowerCase().includes(query.toLowerCase()) ||
      product.category.toLowerCase().includes(query.toLowerCase()) ||
      (product.tags || []).some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );
    setFilteredProducts(filtered);
  };

  const handleScrapeProduct = async () => {
    if (!productUrl.trim()) {
      setScrapingError('Please enter a valid product URL');
      return;
    }

    setIsScrapingProduct(true);
    setScrapingError('');
    setScrapedProduct(null);

    try {
      const response = await fetch('/api/scrape-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: productUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to scrape product' }));
        throw new Error(errorData.error || 'Failed to scrape product');
      }

      const productData = await response.json();
      setScrapedProduct({
        ...productData,
        id: `pending-${Date.now()}`,
        isPending: true
      });
      setScrapingError(''); // Clear any previous errors
    } catch (error) {
      console.error('Error scraping product:', error);
      setScrapingError(error instanceof Error ? error.message : 'Failed to scrape product. Please check the URL and try again.');
      // Don't clear the URL - let user modify and try again
    } finally {
      setIsScrapingProduct(false);
    }
  };

  // Known problematic image sources
  const problematicSources = [
    'source.unsplash.com',
    'unsplash.com/random',
    'picsum.photos',
    'placeholder.com',
    'via.placeholder.com',
    'dummyimage.com'
  ];

  // Check if URL is from a known problematic source
  const checkProblematicSource = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const fullUrl = url.toLowerCase();
      
      for (const source of problematicSources) {
        if (hostname.includes(source) || fullUrl.includes(source)) {
          return source;
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setError('Uploading images...');
    
    const newImages: ProjectImage[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError(`File ${file.name} is not a valid image file`);
        continue;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`File ${file.name} is too large. Maximum size is 10MB`);
        continue;
      }
      
      try {
        // Create object URL for the file
        const objectUrl = URL.createObjectURL(file);
        
        const newImage: ProjectImage = {
          id: Date.now().toString() + Math.random().toString() + i,
          url: objectUrl,
          name: file.name,
          room: '',
          tags: []
        };
        
        newImages.push(newImage);
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        setError(`Failed to process file ${file.name}`);
      }
    }
    
    if (newImages.length > 0) {
      setImages(prev => [...prev, ...newImages]);
      setError(null);
    }
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddImageUrl = async () => {
    if (!imageUrl.trim()) return;
    
    // Basic URL validation
    try {
      new URL(imageUrl);
    } catch {
      setError('Please enter a valid image URL');
      return;
    }
    
    // Check for known problematic sources
    const problematicSource = checkProblematicSource(imageUrl);
    if (problematicSource) {
      setError(`⚠️ Warning: Images from ${problematicSource} are known to be unreliable and may fail to load. Please use a direct image URL from a stable source instead.`);
      return;
    }
    
    // Set loading state
    setError('Validating image...');
    
    // Validate that the image actually loads
    const img = new Image();
    const imageValid = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = imageUrl;
      
      // Timeout after 10 seconds
      setTimeout(() => resolve(false), 10000);
    });
    
    if (!imageValid) {
      setError('❌ Unable to load image from this URL. The image may not exist, the server may be down, or the URL may be incorrect. Please check the URL and try again with a direct image link.');
      return;
    }
    
    const newImage: ProjectImage = {
      id: Date.now().toString() + Math.random().toString(),
      url: imageUrl,
      name: `Image from URL`,
      room: '',
      tags: []
    };
    setImages(prev => [...prev, newImage]);
    setImageUrl('');
    setError(null); // Clear any previous errors
  };

  const handleRoomChange = (imageIndex: number, room: string) => {
    const updatedImages = [...images];
    updatedImages[imageIndex].room = room;
    setImages(updatedImages);
  };

  const handleImageClick = (imageIndex: number, event: React.MouseEvent<HTMLDivElement>) => {
    if (currentStep !== 'tagging') return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    setSelectedImageIndex(imageIndex);
    setPendingTag({ x, y });
    setShowProductModal(true);
    setShowAddProductTab(false);
    setScrapedProduct(null);
    setProductUrl('');
    loadProducts();
  };

  const handleRemoveTag = (imageIndex: number, tagId: string) => {
    setImages(prev => prev.map((img, index) => 
      index === imageIndex 
        ? { ...img, tags: img.tags.filter(tag => tag.id !== tagId) }
        : img
    ));
  };

  const handleRemoveImage = (imageIndex: number) => {
    setImages(prev => prev.filter((_, index) => index !== imageIndex));
  };

  const handleCreateProject = async () => {
    // Prevent multiple simultaneous submissions
    if (isSubmitting) {
      return;
    }

    if (!projectName.trim()) {
      setError('Project name is required');
      setCurrentStep('details');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      // Filter out images that failed to load
      const validImages = images.filter(img => !imageLoadErrors.has(img.id));
      const failedImages = images.filter(img => imageLoadErrors.has(img.id));
      
      if (validImages.length === 0) {
        if (failedImages.length > 0) {
          setError(`All ${failedImages.length} image(s) failed to load. Please check your image URLs and try again, or upload different images.`);
        } else {
          setError('At least one valid image is required');
        }
        setCurrentStep('images');
        setIsSubmitting(false);
        return;
      }
      
      // Warn user if some images failed but still allow project creation
      if (failedImages.length > 0) {
        const proceed = confirm(
          `${failedImages.length} image(s) failed to load and will be excluded from the project. ` +
          `Do you want to proceed with the ${validImages.length} valid image(s)?`
        );
        if (!proceed) {
          setIsSubmitting(false);
          setCurrentStep('images');
          return;
        }
      }

      const projectData: any = {
        name: projectName,
        description: projectDescription,
        client: projectClient,
        category: projectCategory,
        designerId: selectedDesigner || 'current-designer',
        images: validImages,
        status: 'published',
        isDraft: false
      };

      // If editing, include the project ID
      if (editingProject) {
        projectData.id = editingProject.id;
      }

      const response = await fetch('/api/projects', {
        method: editingProject ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: `Failed to ${editingProject ? 'update' : 'create'} project` 
        }));
        throw new Error(errorData.error || `Failed to ${editingProject ? 'update' : 'create'} project`);
      }

      const project = await response.json();
      
      // Clear the draft since project was created/updated successfully
      clearDraft();
      
      // Call the parent callback
      onProjectCreated(project);
      
      // Reset form
      setProjectName('');
      setProjectDescription('');
      setProjectClient('');
      setProjectCategory('');
      setImages([]);
      setCurrentStep('details');
      setImageLoadErrors(new Set());
      setError(null);
      
      onClose();
    } catch (error) {
      console.error(`Error ${editingProject ? 'updating' : 'creating'} project:`, error);
      setError(error instanceof Error ? error.message : `Failed to ${editingProject ? 'update' : 'create'} project. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedToImages = projectName.trim() && projectCategory.trim();
  const canProceedToTagging = images.length > 0;
  const canCreateProject = canProceedToTagging;

  // Auto-save draft functionality - DISABLED to prevent multiple saves
  useEffect(() => {
    const saveDraft = async () => {
      // Skip auto-save if already submitting or saving draft
      if (isSubmitting || isSavingDraft) return;
      
      if (projectName || projectDescription || projectClient || images.length > 0) {
        try {
          setIsSavingDraft(true);
          
          // Only save to localStorage, not to API to prevent multiple saves
          const draft = {
            projectName,
            description: projectDescription,
            client: projectClient,
            category: projectCategory,
            images: images.map(img => ({
              ...img,
              url: imageLoadErrors.has(img.id) ? '' : img.url
            })),
            timestamp: new Date().toISOString()
          };
          localStorage.setItem('project_draft', JSON.stringify(draft));
          setDraftSaved(true);
          setTimeout(() => setDraftSaved(false), 2000);
        } catch (error) {
          console.error('Error saving draft:', error);
        } finally {
          setIsSavingDraft(false);
        }
      }
    };

    const draftTimer = setTimeout(saveDraft, 3000); // Auto-save after 3 seconds of inactivity
    return () => clearTimeout(draftTimer);
  }, [projectName, projectDescription, projectClient, projectCategory, images, imageLoadErrors, selectedDesigner, isSubmitting, isSavingDraft]);

  // Load draft on component mount
  useEffect(() => {
    const loadDraft = () => {
      try {
        const saved = localStorage.getItem('project_draft');
        if (saved) {
          const draft = JSON.parse(saved);
          // Only load if draft is less than 24 hours old
          const draftAge = Date.now() - new Date(draft.timestamp).getTime();
          if (draftAge < 24 * 60 * 60 * 1000) {
            setProjectName(draft.projectName || '');
            setProjectDescription(draft.description || '');
            setProjectClient(draft.client || '');
            setProjectCategory(draft.category || 'Residential');
            setImages(draft.images || []);
          }
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    };

    loadDraft();
  }, []);

  const clearDraft = () => {
    localStorage.removeItem('project_draft');
  };

  const handleImageError = (imageId: string) => {
    setImageLoadErrors(prev => new Set(Array.from(prev).concat([imageId])));
    setImageLoadingStates(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
    
    // Show a more helpful error message
    const failedImage = images.find(img => img.id === imageId);
    if (failedImage) {
      console.warn(`Image failed to load: ${failedImage.url}`);
      // Don't set a global error immediately - let user try to fix it
    }
  };

  const retryImageLoad = (imageId: string) => {
    // Remove from error state to trigger a reload
    setImageLoadErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
    setImageLoadingStates(prev => new Set(Array.from(prev).concat([imageId])));
  };

  const handleImageLoad = (imageId: string) => {
    setImageLoadErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
    setImageLoadingStates(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
    // Clear any image-related errors when an image loads successfully
    if (error && error.includes('images failed to load')) {
      setError(null);
    }
  };

  const handleImageLoadStart = (imageId: string) => {
    setImageLoadingStates(prev => new Set(Array.from(prev).concat([imageId])));
  };

  const handleProductSelect = async (product: Product) => {
    if (selectedImageIndex === null || pendingTag === null) return;

    try {
      setError('Adding product tag...'); // Show loading state
      
      const newTag: ProductTag = {
        id: `tag-${Date.now()}`,
        x: pendingTag.x,
        y: pendingTag.y,
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        productPrice: typeof product.price === 'string' 
          ? parseFloat(product.price.replace(/[^0-9.]/g, '')) 
          : typeof product.price === 'number' ? product.price : 0,
        productBrand: product.brand,
        isPending: product.isPending || false
      };

      // If it's a pending product, save it to the pending products API
      if (product.isPending) {
        try {
          const pendingResponse = await fetch('/api/admin/pending-products', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: product.name,
              brand: product.brand,
              price: newTag.productPrice,
              image: product.image,
              category: product.category || 'furniture',
              tags: product.tags || [],
              isPending: true
            }),
          });
          
          if (!pendingResponse.ok) {
            const errorData = await pendingResponse.json().catch(() => ({ error: 'Failed to save pending product' }));
            console.warn('Failed to save pending product:', errorData);
            // Don't fail the tag creation if pending product save fails, just warn
            setError('⚠️ Product tagged successfully, but there was an issue saving it for admin review. The tag will still work.');
            setTimeout(() => setError(null), 3000);
          }
        } catch (error) {
          console.error('Error saving pending product:', error);
          // Don't fail the tag creation if pending product save fails
          setError('⚠️ Product tagged successfully, but there was an issue saving it for admin review. The tag will still work.');
          setTimeout(() => setError(null), 3000);
        }
      }

      // Add tag to the image
      const updatedImages = [...images];
      updatedImages[selectedImageIndex].tags.push(newTag);
      setImages(updatedImages);

      // Note: Draft auto-save removed - tags are saved to DB immediately via API
      // The tag was successfully saved above, no need for additional draft save

      // Reset states
      setShowProductModal(false);
      setPendingTag(null);
      setSelectedImageIndex(null);
      setSearchQuery('');
      setScrapedProduct(null);
      setProductUrl('');
      setScrapingError('');
      setError(null); // Clear loading state
    } catch (error) {
      console.error('Error adding product tag:', error);
      setError('❌ Failed to add product tag. This could be due to a network issue or server problem. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </h2>
              <p className="text-gray-600 mt-1">
                {currentStep === 'details' && (editingProject ? 'Update project details' : 'Enter project details')}
                {currentStep === 'images' && (editingProject ? 'Update project images' : 'Add project images')}
                {currentStep === 'tagging' && 'Tag products in your images'}
              </p>
              {draftSaved && (
                <p className="text-green-600 text-sm mt-1 flex items-center">
                  <FaCheck className="w-3 h-3 mr-1" />
                  Draft saved automatically
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-6 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FaTimes className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-600 hover:text-red-800 text-sm underline mt-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center py-4 border-b border-gray-100">
            <div className="flex items-center space-x-4">
              {['details', 'images', 'tagging'].map((step, index) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep === step 
                      ? 'bg-blue-600 text-white' 
                      : index < ['details', 'images', 'tagging'].indexOf(currentStep)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index < ['details', 'images', 'tagging'].indexOf(currentStep) ? (
                      <FaCheck className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-700 capitalize">
                    {step}
                  </span>
                  {index < 2 && <div className="w-8 h-px bg-gray-300 ml-4" />}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {currentStep === 'details' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      placeholder="Enter project name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={projectCategory}
                      onChange={(e) => setProjectCategory(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    >
                      <option value="">Select category</option>
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="hospitality">Hospitality</option>
                      <option value="retail">Retail</option>
                      <option value="office">Office</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={projectClient}
                    onChange={(e) => setProjectClient(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder="Client or company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                    placeholder="Describe your project..."
                  />
                </div>
              </div>
            )}

            {currentStep === 'images' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <FaUpload className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Upload Images</p>
                    <p className="text-gray-400 text-sm">Click to select files</p>
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8">
                    <FaLink className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-3">Add from URL</p>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          className={`flex-1 px-3 py-2 border rounded-lg text-sm text-gray-900 ${
                            imageUrl && checkProblematicSource(imageUrl)
                              ? 'border-orange-400 bg-orange-50'
                              : 'border-gray-300'
                          }`}
                          placeholder="https://example.com/image.jpg"
                        />
                        <button
                          onClick={handleAddImageUrl}
                          disabled={!imageUrl.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      {imageUrl && checkProblematicSource(imageUrl) && (
                        <div className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                          <FaExclamationTriangle className="w-3 h-3 text-orange-600 mt-0.5 flex-shrink-0" />
                          <span className="text-orange-700">
                            Warning: {checkProblematicSource(imageUrl)} is known to be unreliable. Use a direct image URL instead.
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        💡 Tip: Use direct image URLs (ending in .jpg, .png, .webp) for best results
                      </p>
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {images.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {images.map((image, index) => (
                      <div key={image.id} className="relative group">
                        <div className="relative aspect-square rounded-lg overflow-hidden">
                          {imageLoadErrors.has(image.id) ? (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <div className="text-center">
                                <FaTimes className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">Failed to load image</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    retryImageLoad(image.id);
                                  }}
                                  className="text-blue-600 text-xs mt-1 hover:underline"
                                >
                                  Retry
                                </button>
                              </div>
                            </div>
                          ) : (
                            <Image
                              src={image.url}
                              alt={image.name}
                              fill
                              className="object-cover"
                              onError={(e) => handleImageError(image.id)}
                              onLoad={() => handleImageLoad(image.id)}
                              unoptimized={true} // Allow external images without optimization
                            />
                          )}
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <FaTimes className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-gray-600 truncate">{image.name}</p>
                          <input
                            type="text"
                            value={image.room}
                            onChange={(e) => handleRoomChange(index, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                            placeholder="Room (e.g. Living Room, Master Bath)"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Image Status Summary */}
                {images.length > 0 && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="text-gray-700">
                          <strong>{images.length - imageLoadErrors.size}</strong> of <strong>{images.length}</strong> images ready
                        </span>
                        {imageLoadErrors.size > 0 && (
                          <span className="text-orange-600 flex items-center gap-1">
                            <FaExclamationTriangle className="w-4 h-4" />
                            {imageLoadErrors.size} failed to load
                          </span>
                        )}
                      </div>
                      {imageLoadErrors.size > 0 && (
                        <button
                          onClick={() => setImageLoadErrors(new Set())}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Retry all failed images
                        </button>
                      )}
                    </div>
                    {imageLoadErrors.size > 0 && (
                      <p className="text-xs text-gray-600 mt-2">
                        Don't worry! You can still create your project with the working images. Failed images will be excluded automatically.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentStep === 'tagging' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <FaTag className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">How to tag products</h4>
                      <p className="text-blue-700 text-sm mt-1">
                        Click on any part of your images to tag products. Search existing products or add new ones from URLs. Products added from URLs will be marked as pending for admin review.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {images.map((image, index) => (
                    <div key={image.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{image.name}</h4>
                          {image.room && (
                            <p className="text-sm text-blue-600">{image.room}</p>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {(image.tags || []).length} tag{(image.tags || []).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div
                        className="relative aspect-video rounded-lg overflow-hidden cursor-crosshair border-2 border-gray-200 hover:border-blue-400 transition-colors"
                        onClick={(e) => handleImageClick(index, e)}
                      >
                        {imageLoadErrors.has(image.id) ? (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <div className="text-center">
                              <FaTimes className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-500 text-sm">Failed to load image</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  retryImageLoad(image.id);
                                }}
                                className="text-blue-600 text-xs mt-1 hover:underline"
                              >
                                Retry
                              </button>
                            </div>
                          </div>
                        ) : (
                          <Image
                            src={image.url}
                            alt={image.name}
                            fill
                            className="object-cover"
                            onError={(e) => handleImageError(image.id)}
                            onLoad={() => handleImageLoad(image.id)}
                            unoptimized={true}
                          />
                        )}
                        {(image.tags || []).map((tag) => (
                          <div
                            key={tag.id}
                            className={`absolute w-4 h-4 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group hover:scale-125 transition-transform ${
                              tag.isPending ? 'bg-orange-500' : 'bg-blue-600'
                            }`}
                            style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
                          >
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <div className="bg-white rounded-lg shadow-lg p-3 min-w-[200px] border">
                                <div className="flex items-start gap-3">
                                  <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                                    <Image
                                      src={tag.productImage}
                                      alt={tag.productName}
                                      fill
                                      className="object-cover"
                                      unoptimized={true}
                                      onError={(e) => {
                                        // Fallback to a placeholder if product image fails
                                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyOEMyNS41MjI5IDI4IDMwIDIzLjUyMjkgMzAgMThDMzAgMTIuNDc3MSAyNS41MjI5IDggMjAgOEMxNC40NzcxIDggMTAgMTIuNDc3MSAxMCAxOEMxMCAyMy41MjI5IDE0LjQ3NzEgMjggMjAgMjhaIiBmaWxsPSIjRDFEOUUwIi8+CjxwYXRoIGQ9Ik0yMCAyMkMyMi4yMDkxIDIyIDI0IDIwLjIwOTEgMjQgMThDMjQgMTUuNzkwOSAyMi4yMDkxIDE0IDIwIDE0QzE3Ljc5MDkgMTQgMTYgMTUuNzkwOSAxNiAxOEMxNiAyMC4yMDkxIDE3Ljc5MDkgMjIgMjAgMjJaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo=';
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h5 className="font-medium text-gray-900 text-sm truncate">
                                        {tag.productName}
                                      </h5>
                                      {tag.isPending && (
                                        <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-gray-600 text-xs">{tag.productBrand}</p>
                                    <p className="text-blue-600 font-medium text-sm">
                                      ${tag.productPrice}
                                    </p>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveTag(index, tag.id);
                                    }}
                                    className="text-red-500 hover:text-red-700 transition-colors"
                                  >
                                    <FaTimes className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center p-6 border-t border-gray-200">
            <div className="flex gap-3">
              {currentStep !== 'details' && (
                <button
                  onClick={() => {
                    if (currentStep === 'images') setCurrentStep('details');
                    if (currentStep === 'tagging') setCurrentStep('images');
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              {currentStep === 'details' && (
                <button
                  onClick={() => setCurrentStep('images')}
                  disabled={!canProceedToImages}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Next: Add Images
                </button>
              )}
              {currentStep === 'images' && (
                <button
                  onClick={() => setCurrentStep('tagging')}
                  disabled={!canProceedToTagging}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Next: Tag Products
                </button>
              )}
              {currentStep === 'tagging' && (
                <button
                  onClick={handleCreateProject}
                  disabled={!canCreateProject || isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <FaSpinner className="animate-spin w-4 h-4" />
                      {editingProject ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingProject ? 'Update Project' : 'Create Project'
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {showProductModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60"
            onClick={() => setShowProductModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden shadow-2xl m-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Select or Add Product</h3>
                  <button
                    onClick={() => setShowProductModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <FaTimes className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex border-b border-gray-200 mb-4">
                  <button
                    onClick={() => setShowAddProductTab(false)}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                      !showAddProductTab 
                        ? 'border-blue-500 text-blue-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FaSearch className="inline mr-2" />
                    Search Products
                  </button>
                  <button
                    onClick={() => setShowAddProductTab(true)}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                      showAddProductTab 
                        ? 'border-blue-500 text-blue-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FaPlus className="inline mr-2" />
                    Add from URL
                  </button>
                </div>

                {!showAddProductTab && (
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleProductSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      placeholder="Search products..."
                    />
                  </div>
                )}

                {showAddProductTab && (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <input
                        type="url"
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                        placeholder="https://example.com/product-page"
                        disabled={isScrapingProduct}
                      />
                      <button
                        onClick={handleScrapeProduct}
                        disabled={!productUrl.trim() || isScrapingProduct}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                      >
                        {isScrapingProduct ? (
                          <>
                            <FaSpinner className="animate-spin" />
                            Scraping...
                          </>
                        ) : (
                          'Get Product'
                        )}
                      </button>
                    </div>
                    
                    {scrapingError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        <FaExclamationTriangle className="w-4 h-4" />
                        <span className="text-sm">{scrapingError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {!showAddProductTab && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {(filteredProducts || []).map((product) => (
                      <div
                        key={product.id}
                        onClick={() => handleProductSelect(product)}
                        className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
                      >
                        <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            className="object-cover"
                            unoptimized={true}
                            onError={(e) => {
                              // Fallback to a placeholder if product image fails
                              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyOEMyNS41MjI5IDI4IDMwIDIzLjUyMjkgMzAgMThDMzAgMTIuNDc3MSAyNS41MjI5IDggMjAgOEMxNC40NzcxIDggMTAgMTIuNDc3MSAxMCAxOEMxMCAyMy41MjI5IDE0LjQ3NzEgMjggMjAgMjhaIiBmaWxsPSIjRDFEOUUwIi8+CjxwYXRoIGQ9Ik0yMCAyMkMyMi4yMDkxIDIyIDI0IDIwLjIwOTEgMjQgMThDMjQgMTUuNzkwOSAyMi4yMDkxIDE0IDIwIDE0QzE3Ljc5MDkgMTQgMTYgMTUuNzkwOSAxNiAxOEMxNiAyMC4yMDkxIDE3Ljc5MDkgMjIgMjAgMjJaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo=';
                            }}
                          />
                        </div>
                        <h4 className="font-medium text-gray-900 text-sm mb-1 truncate">
                          {product.name}
                        </h4>
                        <p className="text-gray-600 text-xs mb-2">{product.brand}</p>
                        <p className="text-blue-600 font-medium text-sm">${product.price}</p>
                      </div>
                    ))}
                  </div>
                )}

                {showAddProductTab && scrapedProduct && (
                  <div className="max-w-md mx-auto">
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-2 text-orange-800">
                        <FaExclamationTriangle className="w-4 h-4" />
                        <span className="font-medium text-sm">Pending Product</span>
                      </div>
                      <p className="text-orange-700 text-xs mt-1">
                        This product will be marked as pending and reviewed by admins before being added to the main catalog.
                      </p>
                    </div>
                    
                    <div
                      onClick={() => handleProductSelect(scrapedProduct)}
                      className="bg-white border-2 border-orange-300 rounded-xl p-6 cursor-pointer hover:shadow-lg hover:border-orange-400 transition-all"
                    >
                      <div className="relative aspect-square rounded-lg overflow-hidden mb-4">
                        <Image
                          src={scrapedProduct.image || '/placeholder-product.jpg'}
                          alt={scrapedProduct.name}
                          fill
                          className="object-cover"
                          unoptimized={true}
                          onError={(e) => {
                            // Fallback to a placeholder if scraped product image fails
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyOEMyNS41MjI5IDI4IDMwIDIzLjUyMjkgMzAgMThDMzAgMTIuNDc3MSAyNS41MjI5IDggMjAgOEMxNC40NzcxIDggMTAgMTIuNDc3MSAxMCAxOEMxMCAyMy41MjI5IDE0LjQ3NzEgMjggMjAgMjhaIiBmaWxsPSIjRDFEOUUwIi8+CjxwYXRoIGQ9Ik0yMCAyMkMyMi4yMDkxIDIyIDI0IDIwLjIwOTEgMjQgMThDMjQgMTUuNzkwOSAyMi4yMDkxIDE0IDIwIDE0QzE3Ljc5MDkgMTQgMTYgMTUuNzkwOSAxNiAxOEMxNiAyMC4yMDkxIDE3Ljc5MDkgMjIgMjAgMjJaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo=';
                          }}
                        />
                      </div>
                      <h4 className="font-medium text-gray-900 text-lg mb-2">
                        {scrapedProduct.name}
                      </h4>
                      <p className="text-gray-600 text-sm mb-2">{scrapedProduct.brand}</p>
                      <p className="text-blue-600 font-medium text-lg mb-3">{scrapedProduct.price}</p>
                      {scrapedProduct.description && (
                        <p className="text-gray-600 text-sm line-clamp-3">{scrapedProduct.description}</p>
                      )}
                      <div className="mt-4 text-center">
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                          <FaPlus className="w-3 h-3" />
                          Use This Product
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {!showAddProductTab && filteredProducts && filteredProducts.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No products found</p>
                    <button
                      onClick={() => setShowAddProductTab(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <FaPlus className="w-4 h-4" />
                      Add Product from URL
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default ProjectCreationModal; 