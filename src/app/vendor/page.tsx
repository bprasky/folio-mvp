'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaChartLine, FaShoppingCart, FaStore, FaUser, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import VendorDashboard from '@/app/vendor/dashboard/page';
import ProductUploader from '@/components/vendor/ProductUploader';
import Navigation from '@/components/Navigation';
import ProfileSwitcher from '@/components/ProfileSwitcher';
import { useRole } from '../../contexts/RoleContext';

const mockProducts = [
    {
      id: 1,
      name: 'Modern Sofa',
      category: 'Furniture',
      price: '$1,299',
      stock: 15,
      image: 'https://source.unsplash.com/random/800x600?modern,sofa,furniture',
      views: 1234,
      orders: 45,
      vendorId: 'vendor-1'
    },
    {
      id: 2,
      name: 'Designer Lamp',
      category: 'Lighting',
      price: '$299',
      stock: 8,
      image: 'https://source.unsplash.com/random/800x600?designer,lamp,lighting',
      views: 856,
      orders: 23,
      vendorId: 'vendor-2'
    },
    // Add more mock products as needed
  ];

export default function VendorProfile() {
  const { role, activeProfileId, setActiveProfileId } = useRole();
  const [activeTab, setActiveTab] = useState<'products' | 'analytics' | 'orders'>('products');
  const [showUploader, setShowUploader] = useState(false);
  const [products, setProducts] = useState(mockProducts);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  useEffect(() => {
    if (role === 'admin') {
      loadVendors();
    }
  }, [role]);

  const loadVendors = async () => {
    try {
      const response = await fetch('/vendors.json');
      const data = await response.json();
      setVendors(data);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const handleProfileChange = (profileId: string) => {
    setSelectedVendorId(profileId);
    // Filter products for the selected vendor profile
    const filteredProducts = mockProducts.filter(product => product.vendorId === profileId);
    setProducts(filteredProducts);
  };

  const toggleVendorProfile = (vendorId: string) => {
    const newActiveId = selectedVendorId === vendorId ? '' : vendorId;
    setSelectedVendorId(newActiveId);
    setActiveProfileId(newActiveId);
  };

  // Filter products based on selected vendor for admin
  const getFilteredProducts = () => {
    if (role === 'admin' && selectedVendorId) {
      return products.filter(product => product.vendorId === selectedVendorId);
    }
    return products;
  };

  const getCurrentVendor = () => {
    if (role === 'admin' && selectedVendorId) {
      return vendors.find(v => v.id === selectedVendorId);
    }
    return null;
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
    setProducts(prev => [...prev, newProduct]);
    setShowUploader(false);
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <div className="flex-1 lg:ml-20 xl:ml-56 text-gray-900 p-6 overflow-y-auto">
        {/* Admin Vendor Selection */}
        {role === 'admin' && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Vendor Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedVendorId === vendor.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => toggleVendorProfile(vendor.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <FaStore className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{vendor.name}</h3>
                        <p className="text-sm text-gray-600">{vendor.products?.length || 0} products</p>
                      </div>
                    </div>
                    {selectedVendorId === vendor.id ? (
                      <FaToggleOn className="w-6 h-6 text-green-500" />
                    ) : (
                      <FaToggleOff className="w-6 h-6 text-gray-400" />
                    )}
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
            {getFilteredProducts().map((product) => (
              <div key={product.id} className="glass-panel rounded-lg overflow-hidden">
                <div className="relative h-48">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    priority={product.id === 1}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                      <p className="text-gray-600 text-sm">{product.category}</p>
                    </div>
                    <span className="text-amber-500 font-semibold">{product.price}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                    <span>Stock: {product.stock}</span>
                    <span>Views: {product.views}</span>
                    <span>Orders: {product.orders}</span>
                  </div>
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