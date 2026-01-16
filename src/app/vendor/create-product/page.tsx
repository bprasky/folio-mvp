'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import ProductUploader from '../../../components/vendor/ProductUploader';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

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
    <div className="min-h-screen bg-[var(--bg-base)] flex">


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
              className="inline-flex items-center space-x-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
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
            <h1 className="folio-h1 mb-2">Add New Product</h1>
            <p className="folio-body text-[var(--text-secondary)]">
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
              <RidgeCard padding="xl" className="max-w-md mx-auto">
                <h2 className="folio-h2 mb-4">Ready to Upload?</h2>
                <p className="folio-body text-[var(--text-secondary)] mb-6">
                  Click the button below to start uploading your product
                </p>
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => setShowUploader(true)}
                >
                  Start Upload
                </Button>
              </RidgeCard>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
} 