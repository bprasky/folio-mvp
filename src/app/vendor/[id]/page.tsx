'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { FaExternalLinkAlt, FaHeart, FaEye, FaTag, FaStar, FaFire, FaChartLine, FaCrown, FaArrowLeft, FaArrowRight, FaStore } from 'react-icons/fa';
interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  category?: string;
  brand?: string;
  url?: string;
  materialBankUrl?: string;
  tags: number;
  saves: number;
  views: number;
}

interface TaggedImage {
  id: string;
  url: string;
  projectId: string;
  projectName: string;
  designerName: string;
  room: string;
  products: Product[];
  tags: number;
  saves: number;
  views: number;
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
  companyName?: string;
  description?: string;
  logo?: string;
  website?: string;
  materialBankUrl?: string;
  products: Product[];
  metrics: {
    totalProjects: number;
    totalDesigners: number;
    mostPopularRoom: string;
    trendingProduct: string;
  };
}

export default function VendorProfile() {
  const params = useParams();
  const vendorId = params?.id as string;
  
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [taggedImages, setTaggedImages] = useState<TaggedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [activeProductIndex, setActiveProductIndex] = useState(0);

  useEffect(() => {
    if (vendorId) {
      loadVendorData();
    }
  }, [vendorId]);

  const loadVendorData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load vendor details
      const vendorResponse = await fetch(`/api/vendors?id=${vendorId}`);
      const vendorData = await vendorResponse.json();

      if (!vendorData.success) {
        throw new Error('Failed to load vendor data');
      }

      setVendor(vendorData.vendor);

      // Load tagged images for this vendor
      const imagesResponse = await fetch(`/api/vendor-tagged-images?vendorId=${vendorId}`);
      const imagesData = await imagesResponse.json();

      if (imagesData.success) {
        setTaggedImages(imagesData.images);
      }

    } catch (error) {
      console.error('Error loading vendor data:', error);
      setError('Failed to load vendor profile');
    } finally {
      setLoading(false);
    }
  };

  const getBadgeForProduct = (product: Product, index: number) => {
    if (index === 0) return { type: 'top', label: 'Top Product', icon: FaCrown, color: 'bg-yellow-500' };
    if (product.tags > 50) return { type: 'hot', label: 'Hot Seller', icon: FaFire, color: 'bg-red-500' };
    if (product.saves > 20) return { type: 'liked', label: 'Frequently Liked', icon: FaHeart, color: 'bg-pink-500' };
    if (product.views > 1000) return { type: 'viral', label: 'Viral', icon: FaChartLine, color: 'bg-purple-500' };
    return null;
  };

  const getBadgeForImage = (image: TaggedImage, index: number) => {
    if (index === 0) return { type: 'featured', label: "Editor's Pick", icon: FaStar, color: 'bg-blue-500' };
    if (image.saves > 30) return { type: 'popular', label: 'Popular', icon: FaHeart, color: 'bg-pink-500' };
    if (image.views > 2000) return { type: 'trending', label: 'Trending', icon: FaChartLine, color: 'bg-purple-500' };
    return null;
  };

  const handleImageHover = (imageId: string) => {
    setHoveredImage(imageId);
    setActiveProductIndex(0);
  };

  const handleProductScroll = (direction: 'left' | 'right', image: TaggedImage) => {
    const maxIndex = image.products.length - 1;
    if (direction === 'left') {
      setActiveProductIndex(prev => prev > 0 ? prev - 1 : maxIndex);
    } else {
      setActiveProductIndex(prev => prev < maxIndex ? prev + 1 : 0);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-folio-background">
        <div className="flex-1   flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-folio-accent"></div>
        </div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="flex min-h-screen bg-folio-background">
        <div className="flex-1   flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaTag className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-folio-text mb-2">Vendor Not Found</h2>
            <p className="text-folio-border">{error || 'This vendor profile could not be loaded.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-folio-background">
      <div className="flex-1  ">
        <div className="max-w-7xl mx-auto px-6 py-8">
          
          {/* SECTION 1: Brand Hero */}
          <div className="mb-12">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-white rounded-xl shadow-sm border border-folio-border overflow-hidden">
                  {vendor.logo ? (
                    <Image src={vendor.logo} alt={vendor.name} width={96} height={96} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-folio-muted flex items-center justify-center">
                      <FaTag className="w-12 h-12 text-folio-accent" />
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-folio-text mb-2">{vendor.name}</h1>
                  <p className="text-folio-border text-lg mb-4">{vendor.description}</p>
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-folio-muted text-folio-text rounded-full text-sm font-medium">
                      {vendor.products[0]?.category || 'General'}
                    </span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
                      <FaExternalLinkAlt className="w-3 h-3" />
                      Available on Material Bank
                    </span>
                    <span className="px-3 py-1 bg-folio-accent text-white rounded-full text-sm font-medium">
                      Used in {vendor.metrics.totalProjects} Projects
                    </span>
                  </div>
                </div>
              </div>
              <button className="px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2">
                <FaHeart className="w-4 h-4" />
                Follow
              </button>
            </div>
          </div>

          {/* SECTION 2: Fibonacci-Style Visual Feed */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-folio-text mb-8">Featured in Designer Projects</h2>
            
            {taggedImages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-folio-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaTag className="w-8 h-8 text-folio-accent" />
                </div>
                <h3 className="text-lg font-medium text-folio-text mb-2">No Projects Yet</h3>
                <p className="text-folio-border mb-4">
                  This vendor's products haven't been tagged in any designer projects yet.
                </p>
                <p className="text-sm text-folio-border">
                  When designers tag this vendor's products in their projects, they'll appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {taggedImages.map((image, index) => {
                  const imageBadge = getBadgeForImage(image, index);
                  const isLarge = index % 6 === 0; // Every 6th image is large (Fibonacci pattern)
                  const isMedium = index % 6 === 1 || index % 6 === 2; // Next 2 are medium
                  const isSmall = index % 6 >= 3; // Rest are small

                  return (
                    <div
                      key={image.id}
                      className={`relative group cursor-pointer transition-all duration-300 ${
                        isLarge ? 'col-span-2 row-span-2' : 
                        isMedium ? 'col-span-1 row-span-1' : 
                        'col-span-1 row-span-1'
                      }`}
                      onMouseEnter={() => handleImageHover(image.id)}
                      onMouseLeave={() => setHoveredImage(null)}
                    >
                      <div className={`relative overflow-hidden rounded-xl bg-white shadow-sm border border-folio-border ${
                        isLarge ? 'h-96' : 
                        isMedium ? 'h-64' : 
                        'h-48'
                      }`}>
                        <Image
                          src={image.url || 'https://source.unsplash.com/random/800x600?interior-design'}
                          alt={image.projectName}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        
                        {/* Image Badge */}
                        {imageBadge && (
                          <div className={`absolute top-4 left-4 ${imageBadge.color} text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1`}>
                            <imageBadge.icon className="w-3 h-3" />
                            {imageBadge.label}
                          </div>
                        )}

                        {/* Image Info Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                          <h3 className="font-semibold text-lg mb-1">{image.projectName}</h3>
                          <p className="text-sm opacity-90">by {image.designerName} • {image.room}</p>
                        </div>

                        {/* Product Carousel on Hover */}
                        {hoveredImage === image.id && image.products.length > 0 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="bg-white rounded-lg p-4 max-w-sm w-full mx-4">
                              <div className="relative">
                                <Image
                                  src={image.products[activeProductIndex]?.imageUrl || 'https://source.unsplash.com/random/400x400?product'}
                                  alt={image.products[activeProductIndex]?.name}
                                  width={200}
                                  height={200}
                                  className="w-full h-48 object-cover rounded-lg mb-3"
                                />
                                
                                {/* Product Badge */}
                                {getBadgeForProduct(image.products[activeProductIndex], activeProductIndex) && (
                                  <div className="absolute top-2 left-2 bg-folio-accent text-white px-2 py-1 rounded text-xs font-medium">
                                    {getBadgeForProduct(image.products[activeProductIndex], activeProductIndex)?.label}
                                  </div>
                                )}

                                <h4 className="font-semibold text-folio-text mb-1">
                                  {image.products[activeProductIndex]?.name}
                                </h4>
                                <p className="text-sm text-folio-border mb-3">
                                  {image.products[activeProductIndex]?.category}
                                </p>

                                {/* Navigation Arrows */}
                                {image.products.length > 1 && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleProductScroll('left', image);
                                      }}
                                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2"
                                    >
                                      <FaArrowLeft className="w-4 h-4 text-folio-text" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleProductScroll('right', image);
                                      }}
                                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2"
                                    >
                                      <FaArrowRight className="w-4 h-4 text-folio-text" />
                                    </button>
                                  </>
                                )}

                                <div className="flex gap-2">
                                  <Link
                                    href={`/product/${image.products[activeProductIndex]?.id}`}
                                    className="flex-1 bg-folio-accent text-white py-2 px-3 rounded text-sm text-center hover:bg-opacity-90 transition-colors"
                                  >
                                    View Product
                                  </Link>
                                  <Link
                                    href={`/project/${image.projectId}`}
                                    className="flex-1 bg-folio-muted text-folio-text py-2 px-3 rounded text-sm text-center hover:bg-folio-border transition-colors"
                                  >
                                    See Project
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 3: Structured Product Grid */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-folio-text mb-8">All Products</h2>
            {vendor.products.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-folio-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaStore className="w-8 h-8 text-folio-accent" />
                </div>
                <h3 className="text-lg font-medium text-folio-text mb-2">No Products Yet</h3>
                <p className="text-folio-border mb-4">
                  This vendor hasn't added any products to their catalog yet.
                </p>
                <p className="text-sm text-folio-border">
                  Products will appear here once they're added to the vendor's inventory.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {vendor.products.map((product, index) => {
                  const badge = getBadgeForProduct(product, index);
                  
                  return (
                    <div key={product.id} className="bg-white rounded-xl shadow-sm border border-folio-border overflow-hidden hover:shadow-md transition-shadow">
                      <div className="relative h-48">
                        <Image
                          src={product.imageUrl || 'https://source.unsplash.com/random/400x400?product'}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                        {badge && (
                          <div className={`absolute top-2 left-2 ${badge.color} text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1`}>
                            <badge.icon className="w-3 h-3" />
                            {badge.label}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-folio-text mb-1">{product.name}</h3>
                        <p className="text-sm text-folio-border mb-2">{product.category}</p>
                        <div className="flex items-center justify-between text-sm text-folio-border mb-3">
                          <span>Used in {product.tags} projects</span>
                          <span>{product.saves} saves</span>
                        </div>
                        <div className="flex gap-2">
                          {product.url && (
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-folio-muted text-folio-text py-2 px-3 rounded text-sm text-center hover:bg-folio-border transition-colors flex items-center justify-center gap-1"
                            >
                              <FaExternalLinkAlt className="w-3 h-3" />
                              View Product
                            </a>
                          )}
                          <Link
                            href={`/product/${product.id}`}
                            className="flex-1 bg-folio-accent text-white py-2 px-3 rounded text-sm text-center hover:bg-opacity-90 transition-colors"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 4: Analytics Snapshot */}
          <div className="bg-white rounded-xl shadow-sm border border-folio-border p-6">
            <h2 className="text-xl font-bold text-folio-text mb-6">Vendor Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-folio-accent mb-1">{vendor.metrics.totalProjects}</div>
                <div className="text-sm text-folio-border">Projects Using This Brand</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-folio-accent mb-1">{vendor.metrics.totalDesigners}</div>
                <div className="text-sm text-folio-border">Designers Using This Brand</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-folio-accent mb-1">{vendor.metrics.mostPopularRoom}</div>
                <div className="text-sm text-folio-border">Most Popular Room</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-folio-accent mb-1">{vendor.metrics.trendingProduct}</div>
                <div className="text-sm text-folio-border">Trending Product</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 