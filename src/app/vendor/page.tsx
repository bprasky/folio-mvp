'use client';

import { useState, useEffect } from 'react';
import Image from '@/components/FolioImage';
import Link from 'next/link';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaChartLine, FaShoppingCart, FaStore, FaUser, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import VendorDashboard from '@/app/vendor/dashboard/page';
import ProductUploader from '@/components/vendor/ProductUploader';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

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
    <div className="p-6 bg-surface-canvas min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Admin Vendor Selection */}
        {role === 'admin' && (
          <div className="mb-6">
            <h2 className="folio-h3 mb-4">Select Vendor Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendors.map((vendor) => (
                <RidgeCard
                  key={vendor.id}
                  padding="md"
                  className={`cursor-pointer transition-all ${
                    selectedVendorId === vendor.id
                      ? 'ring-2 ring-[var(--accent)]'
                      : 'hover:shadow-lg'
                  }`}
                  onClick={() => toggleVendorProfile(vendor.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[var(--accent)]/10 rounded-full flex items-center justify-center">
                        <FaStore className="w-5 h-5 text-[var(--accent)]" />
                      </div>
                      <div>
                        <h3 className="font-medium text-folio-text-primary">{vendor.name}</h3>
                        <p className="folio-meta">{vendor.products?.length || 0} products</p>
                      </div>
                    </div>
                    {selectedVendorId === vendor.id ? (
                      <FaToggleOn className="w-6 h-6 text-[var(--accent)]" />
                    ) : (
                      <FaToggleOff className="w-6 h-6 text-folio-text-tertiary" />
                    )}
                  </div>
                </RidgeCard>
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="folio-h1">
              {role === 'admin' && getCurrentVendor()
                ? `${getCurrentVendor()?.name} Dashboard`
                : 'Vendor Dashboard'
              }
            </h1>
            <p className="folio-body text-folio-text-secondary">
              {role === 'admin' && !selectedVendorId
                ? 'Select a vendor profile above to view their dashboard'
                : 'Manage your products and track performance'
              }
            </p>
          </div>
          <Button
            variant="accent"
            onClick={() => setShowUploader(true)}
            disabled={role === 'admin' && !selectedVendorId}
          >
            <FaPlus className="mr-2" /> Add Product
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6">
          <Button
            variant={activeTab === 'products' ? 'accent' : 'ridge'}
            onClick={() => setActiveTab('products')}
          >
            <FaStore className="mr-2" /> Products
          </Button>
          <Button
            variant={activeTab === 'analytics' ? 'accent' : 'ridge'}
            onClick={() => setActiveTab('analytics')}
          >
            <FaChartLine className="mr-2" /> Analytics
          </Button>
          <Button
            variant={activeTab === 'orders' ? 'accent' : 'ridge'}
            onClick={() => setActiveTab('orders')}
          >
            <FaShoppingCart className="mr-2" /> Orders
          </Button>
        </div>

        {/* Content */}
        {activeTab === 'products' && (role !== 'admin' || selectedVendorId) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFilteredProducts().map((product) => (
              <RidgeCard key={product.id} padding="none" className="overflow-hidden">
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
                      <h3 className="folio-h3">{product.name}</h3>
                      <p className="folio-meta">{product.category}</p>
                    </div>
                    <span className="text-[var(--accent)] font-semibold">{product.price}</span>
                  </div>
                  <div className="flex justify-between items-center folio-meta mb-4">
                    <span>Stock: {product.stock}</span>
                    <span>Views: {product.views}</span>
                    <span>Orders: {product.orders}</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ridge" className="flex-1">
                      <FaEdit className="mr-2" /> Edit
                    </Button>
                    <Button variant="destructive" className="flex-1">
                      <FaTrash className="mr-2" /> Delete
                    </Button>
                  </div>
                </div>
              </RidgeCard>
            ))}
          </div>
        )}

        {activeTab === 'analytics' && (role !== 'admin' || selectedVendorId) && (
          <VendorDashboard />
        )}

        {activeTab === 'orders' && (role !== 'admin' || selectedVendorId) && (
          <RidgeCard padding="lg">
            <h2 className="folio-h2 mb-4">Order Management</h2>
            <p className="folio-body text-folio-text-secondary">Order management content coming soon...</p>
          </RidgeCard>
        )}

        {/* Show message when admin hasn't selected a profile */}
        {role === 'admin' && !selectedVendorId && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-surface-ground rounded-full flex items-center justify-center mx-auto mb-4">
              <FaStore className="w-8 h-8 text-folio-text-tertiary" />
            </div>
            <h3 className="folio-h3 mb-2">No Vendor Selected</h3>
            <p className="folio-body text-folio-text-secondary">Select a vendor profile above to view their dashboard and manage their products.</p>
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