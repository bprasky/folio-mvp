'use client';

import Image from 'next/image';
import { FaHeart, FaBookmark, FaEye, FaCube } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { useState } from 'react';
import Link from 'next/link';

interface InspirePost {
  id: string;
  imageUrl: string;
  title: string;
  author: string;
  authorImage: string;
  likes: number;
  saves: number;
  type: 'regular' | 'featured' | 'boosted' | 'viral';
  aspectRatio: number;
  productLink?: string;
  projectLink?: string;
  designerLink?: string;
}

interface InspireCardProps {
  post: InspirePost;
}

export default function InspireCard({ post }: InspireCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'featured':
        return 'bg-gradient-to-r from-amber-500 to-pink-500';
      case 'boosted':
        return 'bg-gradient-to-r from-blue-500 to-indigo-500';
      case 'viral':
        return 'bg-gradient-to-r from-green-500 to-emerald-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="group relative overflow-hidden rounded-lg shadow-lg bg-[#1a1a1a] border border-[#2e2e2e]"
      style={{ aspectRatio: post.aspectRatio }}
    >
      {/* Image Container */}
      <div className="relative w-full h-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
          </div>
        )}
        
        {!imageError ? (
          <Link href={post.projectLink || '#'}>
            <Image
              src={post.imageUrl}
              alt={post.title}
              fill
              className={`object-cover transition-transform duration-300 group-hover:scale-105 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={true}
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          </Link>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#2a2a2a]">
            <div className="text-gray-400 text-center p-4">
              <p className="text-sm">Image not available</p>
              <p className="text-xs mt-1">{post.title}</p>
            </div>
          </div>
        )}
        
        {/* Overlay */}
        <Link href={post.projectLink || '#'} className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
            <div className="w-full">
                <h3 className="text-white text-lg font-semibold mb-1 truncate">{post.title}</h3>
                <div className="flex items-center space-x-2">
                    {post.designerLink ? (
                        <Link href={post.designerLink} className="flex items-center space-x-2 group/author" onClick={(e) => e.stopPropagation()}>
                            <Image
                                src={post.authorImage}
                                alt={post.author}
                                width={24}
                                height={24}
                                className="rounded-full border border-gray-600 group-hover/author:border-amber-400 transition-colors"
                                priority={true}
                            />
                            <span className="text-gray-300 text-sm group-hover/author:text-amber-400 transition-colors">{post.author}</span>
                        </Link>
                    ) : (
                        <>
                            <Image
                                src={post.authorImage}
                                alt={post.author}
                                width={24}
                                height={24}
                                className="rounded-full border border-gray-600"
                                priority={true}
                            />
                            <span className="text-gray-300 text-sm">{post.author}</span>
                        </>
                    )}
                </div>
            </div>
        </Link>

        {/* Badge */}
        {post.type !== 'regular' && (
          <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-white text-xs font-medium ${getBadgeColor(post.type)} shadow-md`}>
            {post.type.charAt(0).toUpperCase() + post.type.slice(1)}
          </div>
        )}

        {/* Engagement Metrics */}
        <div className="absolute bottom-3 left-3 flex space-x-2">
          <div className="flex items-center space-x-1 bg-black/60 rounded-full px-2.5 py-1 text-white text-xs font-medium">
            <FaHeart className="text-sm" />
            <span>{formatNumber(post.likes)}</span>
          </div>
          <div className="flex items-center space-x-1 bg-black/60 rounded-full px-2.5 py-1 text-white text-xs font-medium">
            <FaBookmark className="text-sm" />
            <span>{formatNumber(post.saves)}</span>
          </div>
        </div>

        {/* Product Pin Icon (Affiliate Link) */}
        {post.productLink && (
          <Link 
            href={post.productLink}
            className="absolute top-3 left-3 bg-amber-500 text-black rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform scale-0 group-hover:scale-100 origin-top-left flex items-center justify-center"
            title="View Featured Product"
            onClick={(e) => e.stopPropagation()}
          >
            <FaCube className="text-lg" />
          </Link>
        )}

        {/* Quick Actions */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex space-x-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button className="bg-white/90 hover:bg-white text-gray-900 rounded-full p-2.5 transition-colors duration-200 shadow-md">
            <FaHeart className="text-lg" />
          </button>
          <button className="bg-white/90 hover:bg-white text-gray-900 rounded-full p-2.5 transition-colors duration-200 shadow-md">
            <FaBookmark className="text-lg" />
          </button>
          <button className="bg-white/90 hover:bg-white text-gray-900 rounded-full p-2.5 transition-colors duration-200 shadow-md">
            <FaEye className="text-lg" />
          </button>
        </div>
      </div>
    </motion.div>
  );
} 