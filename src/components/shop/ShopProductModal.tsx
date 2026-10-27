'use client';

import { useState, useEffect } from 'react';
import Image from '@/components/FolioImage';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaBookmark, FaQuoteLeft } from 'react-icons/fa';

interface ShopProductData {
  id: string;
  productId: string;
  quote: string | null;
  designer: {
    id: string;
    name: string;
    profileImage: string | null;
  };
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    brand: string | null;
    vendorId: string | null;
  };
  contextImages: {
    id: string;
    url: string;
    projectTitle: string;
    projectId: string;
  }[];
  featuredProjects: {
    id: string;
    title: string;
  }[];
}

interface ShopProductModalProps {
  shopProductId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShopProductModal({
  shopProductId,
  isOpen,
  onClose,
}: ShopProductModalProps) {
  const [data, setData] = useState<ShopProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen || !shopProductId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/shop/products/${shopProductId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch product details');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, shopProductId]);

  const handleSave = async () => {
    if (!data || saving) return;

    setSaving(true);
    try {
      // TODO: Implement save to collection
      await new Promise((resolve) => setTimeout(resolve, 500)); // Placeholder
      setSaved(true);
    } catch (err) {
      console.error('Failed to save product:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestQuote = () => {
    // TODO: Implement quote request flow
    console.log('Request quote for product:', data?.productId);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal Content */}
        <motion.div
          className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-surface-ground"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
          >
            <FaTimes className="w-5 h-5 text-folio-text-primary" />
          </button>

          {loading ? (
            <ModalSkeleton />
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-folio-text-secondary">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 rounded-lg bg-folio-text-primary text-white"
              >
                Close
              </button>
            </div>
          ) : data ? (
            <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
              {/* Left: Images */}
              <div className="md:w-3/5 flex flex-col">
                {/* Main Product Image */}
                <div
                  className="relative aspect-square md:aspect-[4/3] bg-surface-elevated"
                >
                  {data.product.imageUrl ? (
                    <Image
                      src={data.product.imageUrl}
                      alt={data.product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg
                        className="w-20 h-20 text-folio-text-tertiary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Context Photos Grid */}
                {data.contextImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-1 p-1 bg-folio-border-subtle">
                    {data.contextImages.slice(0, 4).map((img) => (
                      <Link
                        key={img.id}
                        href={`/project/${img.projectId}`}
                        className="relative aspect-square group"
                      >
                        <Image
                          src={img.url}
                          alt={img.projectTitle}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity text-center px-2">
                            {img.projectTitle}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Info */}
              <div className="md:w-2/5 flex flex-col overflow-y-auto p-6 md:p-8">
                {/* Product Info */}
                <div className="mb-6">
                  <h2
                    className="text-2xl font-semibold mb-2 text-folio-text-primary"
                  >
                    {data.product.name}
                  </h2>
                  {data.product.brand && (
                    <Link
                      href={data.product.vendorId ? `/vendor/${data.product.vendorId}` : '#'}
                      className="text-base hover:underline text-folio-text-secondary"
                    >
                      by {data.product.brand}
                    </Link>
                  )}
                </div>

                {/* Designer Quote */}
                {data.quote && (
                  <div className="mb-8 p-6 rounded-xl bg-surface-elevated">
                    <FaQuoteLeft className="w-5 h-5 mb-3 text-folio-text-tertiary" />
                    <blockquote
                      className="text-base italic mb-4 leading-relaxed text-folio-text-primary"
                    >
                      {data.quote}
                    </blockquote>
                    <div className="flex items-center gap-3">
                      {data.designer.profileImage ? (
                        <Image
                          src={data.designer.profileImage}
                          alt={data.designer.name}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-folio-border-subtle text-folio-text-secondary"
                        >
                          {data.designer.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium text-folio-text-primary">
                        {data.designer.name}
                      </span>
                    </div>
                  </div>
                )}

                {/* Featured In Projects */}
                {data.featuredProjects.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-sm font-medium mb-3 text-folio-text-secondary">
                      Featured in
                    </h3>
                    <div className="space-y-2">
                      {data.featuredProjects.map((project) => (
                        <Link
                          key={project.id}
                          href={`/project/${project.id}`}
                          className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-surface-elevated"
                        >
                          <span className="text-sm text-folio-text-primary">
                            {project.title}
                          </span>
                          <svg
                            className="w-4 h-4 text-folio-text-secondary"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-auto space-y-3">
                  <button
                    onClick={handleRequestQuote}
                    className="w-full py-3 px-6 rounded-xl font-medium transition-colors bg-folio-text-primary text-white"
                  >
                    Request Quote
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={saving || saved}
                    className={`w-full py-3 px-6 rounded-xl font-medium border border-folio-border-subtle transition-colors flex items-center justify-center gap-2 text-folio-text-primary ${saved ? 'bg-surface-elevated' : 'bg-surface-canvas'}`}
                  >
                    <FaBookmark className={saved ? 'text-folio-text-primary' : ''} />
                    {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
                  </button>

                  <Link
                    href={`/product/${data.productId}`}
                    className="w-full py-3 px-6 rounded-xl font-medium border border-folio-border-subtle transition-colors text-center block text-folio-text-secondary"
                  >
                    View Full Product Page
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ModalSkeleton() {
  return (
    <div className="flex flex-col md:flex-row h-full min-h-[400px]">
      <div className="md:w-3/5">
        <div className="aspect-square md:aspect-[4/3] animate-pulse bg-folio-border-subtle" />
      </div>
      <div className="md:w-2/5 p-6 md:p-8 space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-3/4 rounded animate-pulse bg-folio-border-subtle" />
          <div className="h-5 w-1/2 rounded animate-pulse bg-folio-border-subtle" />
        </div>
        <div className="h-32 rounded-xl animate-pulse bg-surface-elevated" />
        <div className="space-y-2">
          <div className="h-10 rounded-lg animate-pulse bg-folio-border-subtle" />
          <div className="h-10 rounded-lg animate-pulse bg-folio-border-subtle" />
        </div>
      </div>
    </div>
  );
}
