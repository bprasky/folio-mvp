'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaHome, FaLightbulb, FaNewspaper, FaStore, FaUsers, FaUser, FaPlus, FaSearch, FaEdit, FaTrash, FaChartLine, FaShoppingCart } from 'react-icons/fa';
import VendorDashboard from '@/app/vendor/dashboard/page';

export default function VendorProfile() {
  const [activeTab, setActiveTab] = useState<'products' | 'analytics' | 'orders'>('products');

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

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <div className="glass-panel w-20 lg:w-56 p-4 lg:p-6 fixed h-full z-20 flex flex-col items-center lg:items-start">
        <div className="w-10 h-10 rounded bg-gradient-to-br from-amber-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl mb-8">F</div>
        <nav className="flex-1 flex flex-col items-center lg:items-start space-y-4">
          <Link href="/" className="p-3 rounded hover:bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaHome className="text-lg" />
            <span className="hidden lg:inline ml-3">Home</span>
          </Link>
          <Link href="/inspire" className="p-3 rounded hover:bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaLightbulb className="text-lg" />
            <span className="hidden lg:inline ml-3">Inspire</span>
          </Link>
          <Link href="/editorials" className="p-3 rounded hover:bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaNewspaper className="text-lg" />
            <span className="hidden lg:inline ml-3">Editorials</span>
          </Link>
          <Link href="/shop" className="p-3 rounded hover:bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaStore className="text-lg" />
            <span className="hidden lg:inline ml-3">Shop</span>
          </Link>
          <Link href="/community" className="p-3 rounded hover:bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaUsers className="text-lg" />
            <span className="hidden lg:inline ml-3">Community</span>
          </Link>
          <Link href="/select-role" className="p-3 rounded bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaUser className="text-lg" />
            <span className="hidden lg:inline ml-3">Profile</span>
          </Link>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-20 xl:ml-56 text-gray-900 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Dashboard</h1>
            <p className="text-gray-600">Manage your products and track performance</p>
          </div>
          <button className="bg-gradient-to-r from-amber-500 to-pink-500 text-white px-6 py-2 rounded-md flex items-center">
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
            {mockProducts.map((product) => (
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
    </div>
  );
} 