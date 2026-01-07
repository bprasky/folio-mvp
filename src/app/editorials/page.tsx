'use client';

import { useState } from 'react';
import Link from 'next/link';
import SafeImage from '../../components/SafeImage';
import { FaClock, FaUser, FaEye, FaFilter, FaSearch } from 'react-icons/fa';

// Sample editorial data - in production this would come from an API
const editorialData = [
  {
    id: 'waterfront-retreat-editorial',
    slug: 'waterfront-retreat-balinese-luxury',
    title: 'Waterfront Retreat: Contemporary Balinese Luxury',
    subtitle: 'A 12,000 SF custom home that captures the essence of modern tropical living',
    excerpt: 'Inspired by its location on Sunset Lake, this spectacular waterfront home resonates with calming energy through natural materials, warm color palettes, and modern organic furnishings.',
    heroImage: 'https://cdn.prod.website-files.com/66f42e113b610c9213331fbc/6706e5e91623c8ee4599a93b_img-1.jpg',
    designerName: 'Sarah Chen',
    designerImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b5c5?auto=format&fit=crop&w=150&q=80',
    category: 'Residential',
    readTime: '8 min read',
    views: 2847,
    publishedAt: '2024-01-15',
    featured: true,
    tags: ['Luxury', 'Waterfront', 'Contemporary', 'Tropical']
  },
  {
    id: 'urban-loft-editorial',
    slug: 'urban-loft-industrial-elegance',
    title: 'Urban Loft: Industrial Elegance Redefined',
    subtitle: 'Converting a 1920s warehouse into a sophisticated urban sanctuary',
    excerpt: 'This stunning loft transformation showcases how industrial heritage can be seamlessly blended with contemporary luxury to create a truly unique living space.',
    heroImage: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    designerName: 'Marcus Rodriguez',
    designerImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    category: 'Commercial',
    readTime: '6 min read',
    views: 1923,
    publishedAt: '2024-01-12',
    featured: false,
    tags: ['Industrial', 'Loft', 'Urban', 'Contemporary']
  },
  {
    id: 'minimalist-sanctuary-editorial',
    slug: 'minimalist-sanctuary-japanese-influence',
    title: 'Minimalist Sanctuary: Japanese-Influenced Serenity',
    subtitle: 'Finding peace through purposeful design and natural materials',
    excerpt: 'This minimalist home draws inspiration from Japanese design principles, creating a serene environment that promotes mindfulness and connection with nature.',
    heroImage: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    designerName: 'Yuki Tanaka',
    designerImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    category: 'Residential',
    readTime: '5 min read',
    views: 3156,
    publishedAt: '2024-01-10',
    featured: true,
    tags: ['Minimalist', 'Japanese', 'Natural', 'Zen']
  }
];

export default function EditorialsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  const categories = ['All', 'Residential', 'Commercial', 'Hospitality', 'Retail'];

  const filteredEditorials = editorialData
    .filter(editorial => {
      const matchesSearch = editorial.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           editorial.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           editorial.designerName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || editorial.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        case 'popular':
          return b.views - a.views;
        case 'trending':
          return b.featured ? 1 : -1;
        default:
          return 0;
      }
    });

  const featuredEditorial = editorialData.find(editorial => editorial.featured);

  return (
    <div className="p-6">
        <div className="max-w-7xl mx-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-gray-900">Editorial Features</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Immersive stories that showcase exceptional design, featuring in-depth project narratives and the creative minds behind them.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-xl shadow-sm border">
            <div className="relative flex-1 max-w-md">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search editorials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex gap-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="newest">Newest</option>
                <option value="popular">Most Popular</option>
                <option value="trending">Trending</option>
              </select>
            </div>
          </div>

          {/* Featured Editorial */}
          {featuredEditorial && (
            <div className="relative">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Editorial</h2>
              <Link href={`/editorials/${featuredEditorial.slug}`}>
                <div className="relative h-[500px] rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer">
                  <SafeImage
                    src={featuredEditorial.heroImage}
                    alt={featuredEditorial.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                        Featured
                      </span>
                      <span className="text-blue-200">{featuredEditorial.category}</span>
                    </div>
                    <h3 className="text-3xl font-bold mb-2">{featuredEditorial.title}</h3>
                    <p className="text-xl text-gray-200 mb-4">{featuredEditorial.subtitle}</p>
                    <div className="flex items-center gap-6 text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <SafeImage
                          src={featuredEditorial.designerImage}
                          alt={featuredEditorial.designerName}
                          className="w-6 h-6 rounded-full"
                        />
                        <span>{featuredEditorial.designerName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FaClock className="w-4 h-4" />
                        <span>{featuredEditorial.readTime}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FaEye className="w-4 h-4" />
                        <span>{featuredEditorial.views.toLocaleString()} views</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Editorial Grid */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">All Editorials</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEditorials.map((editorial) => (
                <Link key={editorial.id} href={`/editorials/${editorial.slug}`}>
                  <article className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer">
                    <div className="relative h-64 overflow-hidden">
                      <SafeImage
                        src={editorial.heroImage}
                        alt={editorial.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="bg-white/90 backdrop-blur-sm text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                          {editorial.category}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {editorial.title}
                      </h3>
                      <p className="text-gray-600 mb-4 line-clamp-3">{editorial.excerpt}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <SafeImage
                            src={editorial.designerImage}
                            alt={editorial.designerName}
                            className="w-8 h-8 rounded-full"
                          />
                          <span className="text-sm font-medium text-gray-700">{editorial.designerName}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <FaClock className="w-3 h-3" />
                            <span>{editorial.readTime}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FaEye className="w-3 h-3" />
                            <span>{editorial.views.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-4">
                        {editorial.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>

          {/* Load More */}
          {filteredEditorials.length > 0 && (
            <div className="text-center">
              <button className="bg-gray-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors">
                Load More Editorials
              </button>
            </div>
          )}

          {/* No Results */}
          {filteredEditorials.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No editorials found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}