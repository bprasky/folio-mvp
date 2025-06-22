'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaChartLine, FaShoppingCart, FaStore } from 'react-icons/fa';
import VendorDashboard from '@/app/vendor/dashboard/page';
import ProductUploader from '@/components/vendor/ProductUploader';
import Navigation from '@/components/Navigation';

const mockProducts = [
    {
      id: 1,
      name: 'Modern Sofa',
      category: 'Furniture',
      price: '$1,299',
      stock: 15,
      image: 'https://source.unsplash.com/random/800x600?modern,sofa,furniture',
      views: 1234,
      orders: 45
    },
    {
      id: 2,
      name: 'Designer Lamp',
      category: 'Lighting',
      price: '$299',
      stock: 8,
      image: 'https://source.unsplash.com/random/800x600?designer,lamp,lighting',
      views: 856,
      orders: 23
    },
    // Add more mock products as needed
  ];

export default function VendorProfile() {
  const [activeTab, setActiveTab] = useState<'products' | 'analytics' | 'orders'>('products');
  const [showUploader, setShowUploader] = useState(false);
  const [products, setProducts] = useState(mockProducts);

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
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Dashboard</h1>
            <p className="text-gray-600">Manage your products and track performance</p>
          </div>
          <button 
            onClick={() => setShowUploader(true)}
            className="bg-gradient-to-r from-amber-500 to-pink-500 text-white px-6 py-2 rounded-md flex items-center hover:from-amber-600 hover:to-pink-600 transition-all duration-300"
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
        {activeTab === 'products' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
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

        {activeTab === 'analytics' && (
          <VendorDashboard />
        )}

        {activeTab === 'orders' && (
          <div className="glass-panel p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Management</h2>
            <p className="text-gray-600">Order management content coming soon...</p>
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