'use client';

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { FaTimes, FaCheck, FaTag, FaSearch, FaTrash } from "react-icons/fa";

interface Product {
  id: string;
  name: string;
  brand: string;
  price: string;
  image: string;
  category: string;
  tags: string[];
}

interface ProductTag {
  id: string;
  x: number;
  y: number;
  productId: string;
  product?: Product;
}

interface AdvancedTagProductsProps {
  imageUrl: string;
  projectId: string;
  existingTags?: ProductTag[];
  onTagsUpdate?: (tags: ProductTag[]) => void;
  isEditable?: boolean;
}

export default function AdvancedTagProducts({ 
  imageUrl, 
  projectId, 
  existingTags = [],
  onTagsUpdate,
  isEditable = true 
}: AdvancedTagProductsProps) {
  const [tags, setTags] = useState<ProductTag[]>(existingTags);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [showProductModal, setShowProductModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Fetch products on component mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch("/api/products");
        if (res.ok) {
          const data = await res.json();
          const productsArray = Array.isArray(data) ? data : [];
          setProducts(productsArray);
          setFilteredProducts(productsArray);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
        setProducts([]);
        setFilteredProducts([]);
      }
    };
    loadProducts();
  }, []);

  // Filter products based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products);
    } else {
      const filtered = (products || []).filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);

  // Update tags when existingTags prop changes
  useEffect(() => {
    setTags(existingTags);
  }, [existingTags]);

  // Handle image click to create new tag
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isEditable) return;
    
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setSelected({ x, y });
    setShowProductModal(true);
    setSearchTerm("");
    setSelectedProductId("");
  };

  // Handle product selection and tag creation
  const handleTagProduct = async () => {
    if (!selected || !selectedProductId) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/tag-product-to-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: selected.x,
          y: selected.y,
          imageUrl,
          projectId,
          productId: selectedProductId,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        const selectedProduct = products.find(p => p.id === selectedProductId);
        
        const newTag: ProductTag = {
          id: result.id || `tag-${Date.now()}`,
          x: selected.x,
          y: selected.y,
          productId: selectedProductId,
          product: selectedProduct
        };

        const updatedTags = [...tags, newTag];
        setTags(updatedTags);
        onTagsUpdate?.(updatedTags);
        
        setSelected(null);
        setSelectedProductId("");
        setShowProductModal(false);
      } else {
        console.error("Failed to create tag");
      }
    } catch (error) {
      console.error("Error creating tag:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle tag deletion
  const handleDeleteTag = async (tagId: string) => {
    if (!isEditable) return;

    try {
      const res = await fetch(`/api/tag-product-to-image/${tagId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const updatedTags = tags.filter(tag => tag.id !== tagId);
        setTags(updatedTags);
        onTagsUpdate?.(updatedTags);
      }
    } catch (error) {
      console.error("Error deleting tag:", error);
    }
  };

  // Get product info for a tag
  const getTagProduct = (tag: ProductTag) => {
    return tag.product || products.find(p => p.id === tag.productId);
  };

  return (
    <div className="relative w-full">
      {/* Main Image Container */}
      <div className="relative group">
        <Image
          ref={imageRef}
          src={imageUrl}
          alt="Taggable project image"
          width={800}
          height={600}
          className={`w-full rounded-xl border border-folio-border shadow-sm ${
            isEditable ? 'cursor-crosshair' : 'cursor-default'
          }`}
          onClick={handleImageClick}
          priority
        />
        
        {/* Existing Tags */}
        {(tags || []).map((tag) => {
          const product = getTagProduct(tag);
          return (
            <motion.div
              key={tag.id}
              className="absolute group/tag"
              style={{ 
                top: `${tag.y}%`, 
                left: `${tag.x}%`, 
                transform: "translate(-50%, -50%)" 
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              onMouseEnter={() => setHoveredTag(tag.id)}
              onMouseLeave={() => setHoveredTag(null)}
            >
              {/* Tag Dot */}
              <div className="relative">
                <div className="w-6 h-6 bg-folio-accent border-2 border-white text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg cursor-pointer hover:bg-folio-text transition-colors">
                  <FaTag className="w-3 h-3" />
                </div>
                
                {/* Product Info Tooltip */}
                <AnimatePresence>
                  {hoveredTag === tag.id && product && (
                    <motion.div
                      className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl border border-folio-border p-3 min-w-64 z-10"
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex items-start gap-3">
                        <Image
                          src={product.image}
                          alt={product.name}
                          width={60}
                          height={60}
                          className="rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-folio-text text-sm truncate">
                            {product.name}
                          </h4>
                          <p className="text-folio-border text-xs">{product.brand}</p>
                          <p className="text-folio-accent font-semibold text-sm">{product.price}</p>
                        </div>
                        {isEditable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTag(tag.id);
                            }}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            title="Remove tag"
                          >
                            <FaTrash className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      
                      {/* Tooltip Arrow */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}

        {/* Pending Tag Dot */}
        {selected && (
          <motion.div
            className="absolute"
            style={{ 
              top: `${selected.y}%`, 
              left: `${selected.x}%`, 
              transform: "translate(-50%, -50%)" 
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <div className="w-6 h-6 bg-folio-accent border-2 border-white text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg animate-pulse">
              <FaTag className="w-3 h-3" />
            </div>
          </motion.div>
        )}

        {/* Instructions Overlay */}
        {isEditable && tags.length === 0 && (
          <div className="absolute inset-0 bg-folio-text bg-opacity-40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="text-white text-center">
              <FaTag className="w-8 h-8 mx-auto mb-2" />
              <p className="text-lg font-semibold">Click to tag products</p>
              <p className="text-sm opacity-80">Click anywhere on the image to tag a product</p>
            </div>
          </div>
        )}
      </div>

      {/* Product Selection Modal */}
      <AnimatePresence>
        {showProductModal && (
          <motion.div
            className="fixed inset-0 bg-folio-text bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowProductModal(false)}
          >
            <motion.div
              className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-folio-border shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-folio-text">Select Product to Tag</h2>
                  <p className="text-folio-border">
                    Position: {selected?.x.toFixed(1)}%, {selected?.y.toFixed(1)}%
                  </p>
                </div>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="text-folio-border hover:text-folio-text transition-colors"
                >
                  <FaTimes className="w-6 h-6" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-4">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-folio-border w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search products by name, brand, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-folio-border rounded-lg focus:ring-1 focus:ring-folio-accent focus:border-folio-accent bg-white text-folio-text placeholder-folio-border"
                />
              </div>

              {/* Products Grid */}
              <div className="flex-1 overflow-y-auto mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(filteredProducts || []).map((product) => (
                    <motion.div
                      key={product.id}
                      className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 ${
                        selectedProductId === product.id
                          ? 'border-folio-accent bg-folio-muted shadow-sm'
                          : 'border-folio-border hover:border-folio-accent hover:shadow-sm'
                      }`}
                      onClick={() => setSelectedProductId(product.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-start gap-3">
                        <Image
                          src={product.image}
                          alt={product.name}
                          width={80}
                          height={80}
                          className="rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-folio-text text-sm mb-1 truncate">
                            {product.name}
                          </h3>
                          <p className="text-folio-border text-xs mb-1">{product.brand}</p>
                          <p className="text-folio-accent font-semibold text-sm mb-2">{product.price}</p>
                          <div className="flex flex-wrap gap-1">
                            {(product.tags || []).slice(0, 3).map((tag, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-folio-muted text-folio-text text-xs rounded-full border border-folio-border"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {filteredProducts.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-folio-border">No products found matching your search.</p>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 px-6 py-3 border border-folio-border text-folio-text rounded-lg hover:bg-folio-muted transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTagProduct}
                  disabled={!selectedProductId || isLoading}
                  className="flex-1 px-6 py-3 bg-folio-text text-white rounded-lg hover:bg-folio-accent disabled:bg-folio-border disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Tagging...
                    </>
                  ) : (
                    <>
                      <FaCheck />
                      Tag Product
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tag Summary */}
      {tags.length > 0 && (
        <motion.div
          className="mt-4 p-4 bg-folio-muted rounded-xl border border-folio-border"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="font-semibold text-folio-text mb-3 flex items-center gap-2">
            <FaTag className="w-4 h-4 text-folio-accent" />
            Tagged Products ({tags.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(tags || []).map((tag) => {
              const product = getTagProduct(tag);
              if (!product) return null;
              
              return (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-folio-border"
                >
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={40}
                    height={40}
                    className="rounded object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-folio-text text-sm truncate">{product.name}</p>
                    <p className="text-folio-accent text-xs">{product.price}</p>
                  </div>
                  {isEditable && (
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className="text-red-500 hover:text-red-700 transition-colors p-1"
                      title="Remove tag"
                    >
                      <FaTrash className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
