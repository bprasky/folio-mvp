'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import Navigation from '../../../components/Navigation';
import ProductUploader from '../../../components/vendor/ProductUploader';

export default function VendorCreateProduct() {
  const [showUploader, setShowUploader] = useState(true);

  // Listen for the product uploader event from navigation
  useEffect(() => {
    const handleOpenUploader = () => {
      setShowUploader(true);
    };

    window.addEventListener('openProductUploader', handleOpenUploader);
    return () => window.removeEventListener('openProductUploader', handleOpenUploader);
  }, []);

  const handleUploaderClose = () => {
    setShowUploader(false);
    // Redirect back to vendor dashboard after closing
    window.location.href = '/vendor';
  };

  const handleProductAdded = (productData: any) => {
    console.log('Product added:', productData);
    // Handle successful product upload
    setShowUploader(false);
    // Redirect to the vendor dashboard
    window.location.href = '/vendor';
  };

  return (
    <div className="min-h-screen bg-primary flex">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8"
          >
            <Link
              href="/vendor"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <FaArrowLeft />
              <span>Back to Vendor Dashboard</span>
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Add New Product</h1>
            <p className="text-gray-600">
              Upload your products to reach designers and homeowners in our community
            </p>
          </motion.div>

          {/* Product Uploader */}
          {showUploader && (
            <ProductUploader
              onClose={handleUploaderClose}
              onProductAdded={handleProductAdded}
            />
          )}

          {/* If uploader is closed, show a fallback */}
          {!showUploader && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md mx-auto">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Ready to Upload?</h2>
                <p className="text-gray-600 mb-6">
                  Click the button below to start uploading your product
                </p>
                <button
                  onClick={() => setShowUploader(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium"
                >
                  Start Upload
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
} 