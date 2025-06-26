'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaArrowLeft, FaArrowRight, FaPlus, FaTrash, FaCheck, FaUser, FaImage, FaTag } from 'react-icons/fa';
import { useRole } from '../../../contexts/RoleContext';
import Navigation from '../../../components/Navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Designer {
  id: string;
  name: string;
  bio?: string;
  profileImage?: string;
}

interface ProjectImage {
  id: string;
  url: string;
  name: string;
  file?: File;
  tags: ProductTag[];
}

interface ProductTag {
  id: string;
  x: number;
  y: number;
  product: {
    id: string;
    name: string;
    brand: string;
    price: string;
    image: string;
    vendorId: string;
  };
}

interface Vendor {
  id: string;
  name: string;
  description?: string;
}

export default function CreateProjectPage() {
  const { role } = useRole();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  
  // Project data
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    category: '',
    client: '',
    designerId: '',
    newDesignerName: ''
  });
  
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string>('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [pendingTag, setPendingTag] = useState<{ x: number; y: number } | null>(null);

  // Product search state
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [products, setProducts] = useState([]);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');

  // Redirect if not admin
  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-primary flex">
        <Navigation />
        <div className="flex-1 lg:ml-20 xl:ml-56 flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Only</h2>
            <p className="text-gray-600">Access denied. Admin role required.</p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadDesigners();
    loadVendors();
    loadProducts();
  }, []);

  const loadDesigners = async () => {
    try {
      const response = await fetch('/api/designers');
      const data = await response.json();
      setDesigners(data);
    } catch (error) {
      console.error('Error loading designers:', error);
    }
  };

  const loadVendors = async () => {
    try {
      const response = await fetch('/vendors.json');
      const data = await response.json();
      setVendors(data);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newImage: ProjectImage = {
          id: Date.now().toString() + Math.random(),
          url: event.target?.result as string,
          name: file.name,
          file,
          tags: []
        };
        setImages(prev => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUrlAdd = () => {
    const urlInput = document.getElementById('imageUrl') as HTMLInputElement;
    const url = urlInput.value.trim();
    if (url) {
      const newImage: ProjectImage = {
        id: Date.now().toString() + Math.random(),
        url,
        name: `Image from URL`,
        tags: []
      };
      setImages(prev => [...prev, newImage]);
      urlInput.value = '';
    }
  };

  const removeImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    if (selectedImageId === imageId) {
      setSelectedImageId('');
    }
  };

  const handleImageClick = (imageId: string, event: React.MouseEvent<HTMLDivElement>) => {
    if (selectedImageId !== imageId) {
      setSelectedImageId(imageId);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    setPendingTag({ x, y });
    setShowProductModal(true);
  };

  const handleProductSelect = async (product: any) => {
    if (!pendingTag || !selectedImageId) return;

    const newTag: ProductTag = {
      id: Date.now().toString(),
      x: pendingTag.x,
      y: pendingTag.y,
      product
    };

    setImages(prev => prev.map(img => 
      img.id === selectedImageId 
        ? { ...img, tags: [...img.tags, newTag] }
        : img
    ));

    setShowProductModal(false);
    setPendingTag(null);
  };

  const handleProductUrlSubmit = async () => {
    if (!productUrl.trim()) return;

    setIsLoadingProduct(true);
    try {
      const response = await fetch('/api/scrape-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl })
      });

      if (response.ok) {
        const productData = await response.json();
        
        // Ensure vendor exists or create new one
        let vendorId = selectedVendorId;
        if (!vendorId && newVendorName.trim()) {
          vendorId = await createVendor(newVendorName.trim());
        }

        const newProduct = {
          ...productData,
          id: Date.now().toString(),
          vendorId: vendorId || 'vendor-new'
        };

        await handleProductSelect(newProduct);
        setProductUrl('');
        setNewVendorName('');
        setSelectedVendorId('');
      }
    } catch (error) {
      console.error('Error scraping product:', error);
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const createVendor = async (vendorName: string): Promise<string> => {
    // In a real app, this would create a vendor in the database
    const newVendor = {
      id: `vendor-${Date.now()}`,
      name: vendorName,
      description: `Vendor for ${vendorName}`
    };
    setVendors(prev => [...prev, newVendor]);
    return newVendor.id;
  };

  const createDesigner = async (designerName: string): Promise<string> => {
    // In a real app, this would create a designer in the database
    const newDesigner = {
      id: `designer-${Date.now()}`,
      name: designerName,
      bio: `Designer profile for ${designerName}`
    };
    setDesigners(prev => [...prev, newDesigner]);
    return newDesigner.id;
  };

  const handleCreateProject = async () => {
    try {
      let designerId = projectData.designerId;
      
      // Create new designer if needed
      if (!designerId && projectData.newDesignerName.trim()) {
        designerId = await createDesigner(projectData.newDesignerName.trim());
      }

      const projectPayload = {
        ...projectData,
        designerId,
        images: images.map(img => ({
          ...img,
          file: undefined // Remove file object for JSON serialization
        }))
      };

      // In a real app, this would save to database
      console.log('Creating project:', projectPayload);
      
      alert('Project created successfully!');
      router.push('/admin');
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error creating project. Please try again.');
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return projectData.name.trim() && projectData.category.trim() && 
               (projectData.designerId || projectData.newDesignerName.trim());
      case 2:
        return images.length > 0;
      case 3:
        return true; // Can always proceed from tagging step
      default:
        return false;
    }
  };

  const filteredProducts = products.filter((product: any) =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.brand.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-primary flex">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/admin"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FaArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Project</h1>
              <p className="text-gray-600">Step {currentStep} of 3</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {[
                { step: 1, label: 'Project Details', icon: FaUser },
                { step: 2, label: 'Upload Images', icon: FaImage },
                { step: 3, label: 'Tag Products', icon: FaTag }
              ].map(({ step, label, icon: Icon }) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    currentStep >= step ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {currentStep > step ? <FaCheck className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    currentStep >= step ? 'text-amber-600' : 'text-gray-600'
                  }`}>
                    {label}
                  </span>
                  {step < 3 && <div className="w-16 h-1 bg-gray-200 mx-4" />}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="bg-white rounded-xl p-8 shadow-sm border border-gray-200"
              >
                <h2 className="text-xl font-bold text-gray-900 mb-6">Project Details</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      value={projectData.name}
                      onChange={(e) => setProjectData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="Modern Living Room Renovation"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={projectData.category}
                      onChange={(e) => setProjectData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                      <option value="">Select Category</option>
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="hospitality">Hospitality</option>
                      <option value="retail">Retail</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Client (Optional)
                    </label>
                    <input
                      type="text"
                      value={projectData.client}
                      onChange={(e) => setProjectData(prev => ({ ...prev, client: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="Client Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Designer *
                    </label>
                    <select
                      value={projectData.designerId}
                      onChange={(e) => setProjectData(prev => ({ ...prev, designerId: e.target.value, newDesignerName: '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                      <option value="">Select Existing Designer</option>
                      {designers.map(designer => (
                        <option key={designer.id} value={designer.id}>{designer.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Or Create New Designer
                    </label>
                    <input
                      type="text"
                      value={projectData.newDesignerName}
                      onChange={(e) => setProjectData(prev => ({ ...prev, newDesignerName: e.target.value, designerId: '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="New Designer Name"
                      disabled={!!projectData.designerId}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={projectData.description}
                      onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="Describe the project..."
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="bg-white rounded-xl p-8 shadow-sm border border-gray-200"
              >
                <h2 className="text-xl font-bold text-gray-900 mb-6">Upload Project Images</h2>
                
                {/* Upload Area */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Files
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <FaImage className="w-12 h-12 text-gray-400 mb-4" />
                      <span className="text-lg font-medium text-gray-900 mb-2">
                        Click to upload images
                      </span>
                      <span className="text-sm text-gray-500">
                        PNG, JPG, GIF up to 10MB each
                      </span>
                    </label>
                  </div>
                </div>

                {/* URL Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Or Add Image URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      id="imageUrl"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="https://example.com/image.jpg"
                    />
                    <button
                      onClick={handleUrlAdd}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Image Grid */}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((image) => (
                      <div key={image.id} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <img
                            src={image.url}
                            alt={image.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={() => removeImage(image.id)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FaTrash className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded truncate">
                          {image.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="bg-white rounded-xl p-8 shadow-sm border border-gray-200"
              >
                <h2 className="text-xl font-bold text-gray-900 mb-6">Tag Products</h2>
                <p className="text-gray-600 mb-6">
                  Click on images to add product tags. You can skip this step and add tags later.
                </p>

                {/* Image Selection */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                        selectedImageId === image.id ? 'border-amber-500' : 'border-transparent hover:border-gray-300'
                      }`}
                      onClick={(e) => handleImageClick(image.id, e)}
                    >
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Existing Tags */}
                      {image.tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="absolute w-4 h-4 bg-amber-500 border-2 border-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${tag.x}%`,
                            top: `${tag.y}%`
                          }}
                          title={tag.product.name}
                        />
                      ))}
                      
                      {/* Tag Count */}
                      {image.tags.length > 0 && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full">
                          {image.tags.length}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Selected Image Tags */}
                {selectedImageId && (
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-3">
                      Tagged Products ({images.find(img => img.id === selectedImageId)?.tags.length || 0})
                    </h3>
                    <div className="space-y-2">
                      {images.find(img => img.id === selectedImageId)?.tags.map((tag) => (
                        <div key={tag.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <img
                            src={tag.product.image}
                            alt={tag.product.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{tag.product.name}</p>
                            <p className="text-sm text-gray-600">{tag.product.brand} • {tag.product.price}</p>
                          </div>
                          <button
                            onClick={() => {
                              setImages(prev => prev.map(img => 
                                img.id === selectedImageId 
                                  ? { ...img, tags: img.tags.filter(t => t.id !== tag.id) }
                                  : img
                              ));
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaArrowLeft className="w-4 h-4" />
              Previous
            </button>

            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <FaArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleCreateProject}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FaCheck className="w-4 h-4" />
                Create Project
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product Selection Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Add Product Tag</h3>
              <p className="text-gray-600">Search existing products or add a new one via URL</p>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* URL Input Section */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Add Product via URL</h4>
                <div className="space-y-3">
                  <input
                    type="url"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Paste product URL here..."
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Vendor
                      </label>
                      <select
                        value={selectedVendorId}
                        onChange={(e) => setSelectedVendorId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      >
                        <option value="">Select Existing Vendor</option>
                        {vendors.map(vendor => (
                          <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Or Create New Vendor
                      </label>
                      <input
                        type="text"
                        value={newVendorName}
                        onChange={(e) => setNewVendorName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        placeholder="New Vendor Name"
                        disabled={!!selectedVendorId}
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleProductUrlSubmit}
                    disabled={!productUrl.trim() || isLoadingProduct}
                    className="w-full bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingProduct ? 'Loading...' : 'Add Product'}
                  </button>
                </div>
              </div>

              {/* Search Existing Products */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Search Existing Products</h4>
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-4"
                  placeholder="Search products..."
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                  {filteredProducts.map((product: any) => (
                    <div
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                        <p className="text-xs text-gray-600">{product.brand} • {product.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setPendingTag(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 