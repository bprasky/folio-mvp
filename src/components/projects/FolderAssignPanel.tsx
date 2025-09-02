"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Check, Tag, Plus, X } from "lucide-react";
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
  createdAt: Date;
}

interface FolderAssignPanelProps {
  folderId: string;
  onUpdate?: () => void;
}

export default function FolderAssignPanel({ folderId, onUpdate }: FolderAssignPanelProps) {
  const { data: session } = useSession();
  const [products, setProducts] = useState<FolderProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [newSection, setNewSection] = useState("");
  const [recentSections, setRecentSections] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Load folder products
  useEffect(() => {
    if (!folderId || !session?.user?.id) return;

    const loadProducts = async () => {
      try {
        const response = await fetch(`/api/designer/folders/${folderId}/products`);
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products || []);
          
          // Extract recent sections
          const sections = [...new Set(data.products
            .map((p: FolderProduct) => p.section)
            .filter(Boolean))];
          setRecentSections(sections.slice(0, 5));
        }
      } catch (error) {
        console.error("Error loading products:", error);
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [folderId, session?.user?.id]);

  const handleSelectItem = (productId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === products.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(products.map(p => p.id)));
    }
  };

  const handleAssignSection = async () => {
    if (!newSection.trim() || selectedItems.size === 0) return;

    setAssigning(true);
    try {
      const response = await fetch(`/api/designer/folders/${folderId}/assign-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: Array.from(selectedItems),
          section: newSection.trim()
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign sections");
      }

      // Update local state
      setProducts(prev => prev.map(p => 
        selectedItems.has(p.id) 
          ? { ...p, section: newSection.trim() }
          : p
      ));

      // Update recent sections
      if (!recentSections.includes(newSection.trim())) {
        setRecentSections(prev => [newSection.trim(), ...prev.slice(0, 4)]);
      }

      toast.success(`Assigned ${selectedItems.size} items to "${newSection.trim()}"`);
      setSelectedItems(new Set());
      setNewSection("");
      onUpdate?.();
    } catch (error) {
      console.error("Error assigning sections:", error);
      toast.error("Failed to assign sections");
    } finally {
      setAssigning(false);
    }
  };

  const handleQuickAssign = (section: string) => {
    if (selectedItems.size === 0) {
      toast.error("Please select items first");
      return;
    }
    setNewSection(section);
    handleAssignSection();
  };

  const handleRemoveSection = async (productId: string) => {
    try {
      const response = await fetch(`/api/designer/folders/${folderId}/assign-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: [productId],
          section: null
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove section");
      }

      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, section: null } : p
      ));

      toast.success("Section removed");
      onUpdate?.();
    } catch (error) {
      console.error("Error removing section:", error);
      toast.error("Failed to remove section");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded-lg w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-xl h-32"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Tag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No products yet</h3>
        <p className="text-gray-500 mb-4">Save products from events to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Organize Products</h2>
          <p className="text-sm text-gray-600 mt-1">
            {selectedItems.size > 0 
              ? `${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''} selected`
              : `${products.length} product${products.length > 1 ? 's' : ''} in folder`
            }
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Select All */}
          <button
            onClick={handleSelectAll}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {selectedItems.size === products.length ? "Deselect All" : "Select All"}
          </button>

          {/* Section Assignment */}
          {selectedItems.size > 0 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                placeholder="Section name..."
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handleAssignSection()}
              />
              <button
                onClick={handleAssignSection}
                disabled={!newSection.trim() || assigning}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {assigning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Assigning...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Assign
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Sections */}
      {recentSections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-600 mr-2">Quick assign:</span>
          {recentSections.map((section) => (
            <button
              key={section}
              onClick={() => handleQuickAssign(section)}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
            >
              {section}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((item) => (
          <div
            key={item.id}
            className={`relative group rounded-2xl border-2 transition-all duration-200 hover:shadow-lg ${
              selectedItems.has(item.id)
                ? "border-blue-500 bg-blue-50 shadow-blue-100"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            {/* Selection Checkbox */}
            <div className="absolute top-3 left-3 z-10">
              <button
                onClick={() => handleSelectItem(item.id)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  selectedItems.has(item.id)
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white border-gray-300 hover:border-blue-400"
                }`}
              >
                {selectedItems.has(item.id) && <Check className="w-3 h-3" />}
              </button>
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
                    <button
                      onClick={() => handleRemoveSection(item.id)}
                      className="ml-1 hover:text-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
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

              {/* Section Input (inline edit) */}
              {!item.section && (
                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Add section..."
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const target = e.target as HTMLInputElement;
                        if (target.value.trim()) {
                          setSelectedItems(new Set([item.id]));
                          setNewSection(target.value.trim());
                          handleAssignSection();
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
