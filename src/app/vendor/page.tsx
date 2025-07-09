'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaChartLine, FaShoppingCart, FaStore, FaUser, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import VendorDashboard from '@/app/vendor/dashboard/page';
import ProductUploader from '@/components/vendor/ProductUploader';
import ProfileSwitcher from '@/components/ProfileSwitcher';
import { useRole } from '../../contexts/RoleContext';

interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  category?: string;
  brand?: string;
  url?: string;
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
  companyName?: string;
  description?: string;
  logo?: string;
  website?: string;
  products?: Product[];
  metrics: {
    products: number;
    followers: number;
    views: number;
  };
}

export default function VendorProfile() {
  const { role, activeProfileId, setActiveProfileId } = useRole();
  const [activeTab, setActiveTab] = useState<'products' | 'analytics' | 'orders'>('products');
  const [showUploader, setShowUploader] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/vendors');
      const data = await response.json();
      
      if (data.success) {
        setVendors(data.vendors || []);
      } else {
        setError('Failed to load vendors');
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
      setError('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const loadVendorDetails = async (vendorId: string) => {
    try {
      const response = await fetch(`/api/vendors?id=${vendorId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedVendor(data.vendor);
      } else {
        setError('Failed to load vendor details');
      }
    } catch (error) {
      console.error('Error loading vendor details:', error);
      setError('Failed to load vendor details');
    }
  };

  const handleProfileChange = (profileId: string) => {
    setSelectedVendorId(profileId);
    loadVendorDetails(profileId);
  };

  const toggleVendorProfile = (vendorId: string) => {
    const newActiveId = selectedVendorId === vendorId ? '' : vendorId;
    setSelectedVendorId(newActiveId);
    setActiveProfileId(newActiveId);
    
    if (newActiveId) {
      loadVendorDetails(newActiveId);
    } else {
      setSelectedVendor(null);
    }
  };

  // Get current vendor for admin view
  const getCurrentVendor = () => {
    if (role === 'admin' && selectedVendorId) {
      return selectedVendor || vendors.find(v => v.id === selectedVendorId);
    }
    return null;
  };

  // Get products for display
  const getDisplayProducts = () => {
    if (role === 'admin' && selectedVendor) {
      return selectedVendor.products || [];
    }
    // For regular vendor users, show their own products
    // This would need to be implemented based on the current user's vendor ID
    return [];
  };

  // Listen for the custom event from the navigation button
  useEffect(() => {
    const handleOpenProductUploader = () => {
      console.log('Product uploader event received'); // Debug log
      setShowUploader(true);
    };

    // Add event listener
    window.addEventListener('openProductUploader', handleOpenProductUploader);

    // Also check for any pending events on mount (in case event was triggered during navigation)
    const checkForPendingEvent = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('openUploader') === 'true') {
        setShowUploader(true);
        // Clean up URL
        window.history.replaceState({}, '', '/vendor');
      }
    };
    
    checkForPendingEvent();

    return () => {
      window.removeEventListener('openProductUploader', handleOpenProductUploader);
    };
  }, []);

  const handleProductAdded = (newProduct: any) => {
    // Refresh vendor data to show the new product
    if (selectedVendorId) {
      loadVendorDetails(selectedVendorId);
    }
    setShowUploader(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-white">
        <div className="flex-1   text-gray-900 p-6 overflow-y-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-folio-accent"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-white">
        <div className="flex-1   text-gray-900 p-6 overflow-y-auto">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaStore className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Vendors</h3>
            <p className="text-gray-600">{error}</p>
            <button 
              onClick={loadVendors}
              className="mt-4 bg-folio-accent text-white px-4 py-2 rounded-md hover:bg-opacity-90"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Navigation */}
      {/* Main Content */}
      <div className="flex-1   text-gray-900 p-6 overflow-y-auto">
        {/* Admin Vendor Selection */}
        {role === 'admin' && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Vendor Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedVendorId === vendor.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        {vendor.logo ? (
                          <img src={vendor.logo} alt={vendor.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <FaStore className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{vendor.name}</h3>
                        <p className="text-sm text-gray-600">{vendor.metrics.products} products</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleVendorProfile(vendor.id)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      {selectedVendorId === vendor.id ? (
                        <FaToggleOn className="w-6 h-6 text-green-500" />
                      ) : (
                        <FaToggleOff className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/vendor/${vendor.id}`}
                      className="flex-1 bg-folio-accent text-white py-2 px-3 rounded text-sm text-center hover:bg-opacity-90 transition-colors"
                    >
                      View Profile
                    </Link>
                    <button
                      onClick={() => toggleVendorProfile(vendor.id)}
                      className="flex-1 bg-gray-800 text-white py-2 px-3 rounded text-sm hover:bg-gray-700 transition-colors"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {role === 'admin' && getCurrentVendor() 
                ? `${getCurrentVendor()?.name} Dashboard` 
                : 'Vendor Dashboard'
              }
            </h1>
            <p className="text-gray-600">
              {role === 'admin' && !selectedVendorId 
                ? 'Select a vendor profile above to view their dashboard'
                : 'Manage your products and track performance'
              }
            </p>
          </div>
          <button 
            onClick={() => setShowUploader(true)}
            className="bg-gradient-to-r from-amber-500 to-pink-500 text-white px-6 py-2 rounded-md flex items-center hover:from-amber-600 hover:to-pink-600 transition-all duration-300"
            disabled={role === 'admin' && !selectedVendorId}
          >
            <FaPlus className="mr-2" /> Add Product
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            className={`px-4 py-2 rounded-md flex items-center ${
              activeTab === 'products' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('products')}
          >
            <FaStore className="mr-2" /> Products
          </button>
          <button
            className={`px-4 py-2 rounded-md flex items-center ${
              activeTab === 'analytics' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('analytics')}
          >
            <FaChartLine className="mr-2" /> Analytics
          </button>
          <button
            className={`px-4 py-2 rounded-md flex items-center ${
              activeTab === 'orders' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('orders')}
          >
            <FaShoppingCart className="mr-2" /> Orders
          </button>
        </div>

        {/* Content */}
        {activeTab === 'products' && (role !== 'admin' || selectedVendorId) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getDisplayProducts().map((product) => (
              <div key={product.id} className="glass-panel rounded-lg overflow-hidden">
                <div className="relative h-48">
                  <Image
                    src={product.imageUrl || 'https://source.unsplash.com/random/800x600?product'}
                    alt={product.name}
                    fill
                    priority={product.id === getDisplayProducts()[0]?.id}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                      <p className="text-gray-600 text-sm">{product.category || 'General'}</p>
                    </div>
                    <span className="text-amber-500 font-semibold">
                      {product.price ? `$${product.price}` : 'Price TBD'}
                    </span>
                  </div>
                  {product.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{product.description}</p>
                  )}
                  <div className="flex space-x-2">
                    <button className="flex-1 bg-gray-800 text-white py-2 rounded-md flex items-center justify-center">
                      <FaEdit className="mr-2" /> Edit
                    </button>
                    <button className="flex-1 bg-red-500 text-white py-2 rounded-md flex items-center justify-center">
                      <FaTrash className="mr-2" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Show message if no products */}
            {getDisplayProducts().length === 0 && (
              <div className="col-span-full text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaStore className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Products Yet</h3>
                <p className="text-gray-600 mb-4">Start by adding your first product to showcase your inventory.</p>
                <button 
                  onClick={() => setShowUploader(true)}
                  className="bg-folio-accent text-white px-6 py-2 rounded-md hover:bg-opacity-90"
                >
                  <FaPlus className="mr-2 inline" /> Add First Product
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (role !== 'admin' || selectedVendorId) && (
          <VendorDashboard />
        )}

        {activeTab === 'orders' && (role !== 'admin' || selectedVendorId) && (
          <div className="glass-panel p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Management</h2>
            <p className="text-gray-600">Order management content coming soon...</p>
          </div>
        )}

        {/* Show message when admin hasn't selected a profile */}
        {role === 'admin' && !selectedVendorId && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaStore className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Vendor Selected</h3>
            <p className="text-gray-600">Select a vendor profile above to view their dashboard and manage their products.</p>
          </div>
        )}
      </div>

      {/* Product Uploader Modal */}
      {showUploader && (
        <ProductUploader
          onProductAdded={handleProductAdded}
          onClose={() => setShowUploader(false)}
        />
      )}
    </div>
  );
} 