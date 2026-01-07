"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Image as ImageIcon, Link as LinkIcon, Tag, Plus, X } from "lucide-react";
import SafeImage from "@/components/SafeImage";

interface FolderProduct {
  id: string;
  product: {
    id: string;
    name: string;
    imageUrl?: string | null;
    price?: number | null;
    vendor?: {
      name: string;
      companyName?: string | null;
    } | null;
  };
  section?: string | null;
}

interface PostFormData {
  title: string;
  content: string;
  affiliate: boolean;
  selectedItems: Set<string>;
}

export default function CreatePostPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('folderId');
  
  const [folderProducts, setFolderProducts] = useState<FolderProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<PostFormData>({
    title: '',
    content: '',
    affiliate: true,
    selectedItems: new Set()
  });

  // Load folder products
  useEffect(() => {
    if (!session?.user?.id || !folderId) return;

    const loadProducts = async () => {
      try {
        const response = await fetch(`/api/designer/folders/${folderId}/products`);
        if (response.ok) {
          const data = await response.json();
          setFolderProducts(data.products || []);
          
          // Pre-select all items
          const allItemIds = new Set(data.products.map((p: FolderProduct) => p.id));
          setFormData(prev => ({ ...prev, selectedItems: allItemIds }));
        }
      } catch (error) {
        console.error("Error loading products:", error);
        toast.error("Failed to load folder products");
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [session?.user?.id, folderId]);

  const handleItemToggle = (itemId: string) => {
    const newSelected = new Set(formData.selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setFormData(prev => ({ ...prev, selectedItems: newSelected }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error("Please enter a post title");
      return;
    }

    if (formData.selectedItems.size === 0) {
      toast.error("Please select at least one item");
      return;
    }

    setSubmitting(true);
    try {
      const selectedProducts = folderProducts.filter(p => formData.selectedItems.has(p.id));
      
      const response = await fetch('/api/designer/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          content: formData.content.trim(),
          folderId,
          affiliate: formData.affiliate,
          items: selectedProducts.map(item => ({
            productName: item.product.name,
            imageUrl: item.product.imageUrl,
            section: item.section,
            baseUrl: item.product.vendor?.name ? `https://example.com/products/${item.product.id}` : undefined
          }))
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create post");
      }

      const data = await response.json();
      toast.success("Post created successfully!");
      router.push(`/posts/${data.post.id}`);
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Failed to create post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded-lg w-1/3 mb-6"></div>
            <div className="space-y-4">
              <div className="h-12 bg-gray-200 rounded-lg"></div>
              <div className="h-32 bg-gray-200 rounded-lg"></div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-gray-200 rounded-xl h-32"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create New Post</h1>
                <p className="text-sm text-gray-500">
                  Share your curated products with the community
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Post Details */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Post Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Post Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Kitchen Mood Board, Bathroom Essentials..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.title.length}/100 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Share your inspiration, design philosophy, or project details..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.content.length}/500 characters
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="affiliate"
                  checked={formData.affiliate}
                  onChange={(e) => setFormData(prev => ({ ...prev, affiliate: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="affiliate" className="text-sm text-gray-700">
                  Enable affiliate tracking for product links
                </label>
              </div>
            </div>
          </div>

          {/* Product Selection */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Select Products ({formData.selectedItems.size} selected)
              </h2>
              
              <button
                type="button"
                onClick={() => {
                  const allItemIds = new Set(folderProducts.map(p => p.id));
                  setFormData(prev => ({ ...prev, selectedItems: allItemIds }));
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folderProducts.map((item) => (
                <div
                  key={item.id}
                  className={`relative group rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                    formData.selectedItems.has(item.id)
                      ? "border-blue-500 bg-blue-50 shadow-blue-100"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                  onClick={() => handleItemToggle(item.id)}
                >
                  {/* Selection Indicator */}
                  <div className="absolute top-3 left-3 z-10">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      formData.selectedItems.has(item.id)
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "bg-white border-gray-300"
                    }`}>
                      {formData.selectedItems.has(item.id) && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                  </div>

                  {/* Product Image */}
                  <div className="relative h-40 bg-gray-100 rounded-t-2xl overflow-hidden">
                    <SafeImage
                      src={item.product.imageUrl || "/images/product-placeholder.jpg"}
                      alt={item.product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Section Badge */}
                    {item.section && (
                      <div className="absolute top-2 right-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-700">
                          <Tag className="w-3 h-3" />
                          {item.section}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
                      {item.product.name}
                    </h3>
                    
                    {item.product.vendor && (
                      <p className="text-sm text-gray-500 mb-2">
                        {item.product.vendor.companyName || item.product.vendor.name}
                      </p>
                    )}

                    {item.product.price && (
                      <p className="text-sm font-semibold text-blue-600">
                        ${item.product.price.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={submitting || !formData.title.trim() || formData.selectedItems.size === 0}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Post
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
