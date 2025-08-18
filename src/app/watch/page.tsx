'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { 
  FaPlay, FaHeart, FaShare, FaEye, FaFilter, FaSearch,
  FaUser, FaTag, FaClock, FaTrendingUp, FaFire,
  FaDesktop, FaPalette, FaBuilding, FaVideo
} from 'react-icons/fa';

interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  creatorId: string;
  creatorType: 'designer' | 'vendor';
  tags: string[];
  views: number;
  likes: number;
  createdAt: string;
  transcriptionStatus: string;
  pullQuotes: { timestamp: number; text: string; }[];
}

interface Creator {
  id: string;
  name: string;
  profileImage: string;
  followers?: number;
}

export default function VideoFeed() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [creators, setCreators] = useState<{ [key: string]: Creator }>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'trending' | 'recent' | 'designers' | 'vendors'>('all');
  const [selectedTag, setSelectedTag] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filters = [
    { id: 'all', label: 'All Videos', icon: FaVideo },
    { id: 'trending', label: 'Trending', icon: FaTrendingUp },
    { id: 'recent', label: 'Recent', icon: FaClock },
    { id: 'designers', label: 'Designers', icon: FaPalette },
    { id: 'vendors', label: 'Vendors', icon: FaBuilding },
  ];

  useEffect(() => {
    loadVideos();
    loadCreators();
  }, []);

  const loadVideos = async () => {
    try {
      const response = await fetch('/api/videos/upload?public=true');
      const data = await response.json();
      
      if (data.success) {
        setVideos(data.videos);
      }
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCreators = async () => {
    try {
      // Load designers
      const designersResponse = await fetch('/api/designers');
      const designersData = await designersResponse.json();
      
      // Load vendors
      const vendorsResponse = await fetch('/api/admin/vendors');
      const vendorsData = await vendorsResponse.json();
      
      const allCreators: { [key: string]: Creator } = {};
      
      designersData.forEach((designer: any) => {
        allCreators[designer.id] = {
          id: designer.id,
          name: designer.name,
          profileImage: designer.profileImage || 'https://source.unsplash.com/random/100x100?designer',
          followers: designer.followers
        };
      });
      
      if (vendorsData.success) {
        vendorsData.vendors.forEach((vendor: any) => {
          allCreators[vendor.id] = {
            id: vendor.id,
            name: vendor.name,
            profileImage: vendor.logo || 'https://source.unsplash.com/random/100x100?vendor',
            followers: vendor.followers
          };
        });
      }
      
      setCreators(allCreators);
    } catch (error) {
      console.error('Error loading creators:', error);
    }
  };

  const getFilteredVideos = () => {
    let filtered = videos;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(video =>
        video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        video.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        video.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply creator type filter
    if (selectedFilter === 'designers') {
      filtered = filtered.filter(video => video.creatorType === 'designer');
    } else if (selectedFilter === 'vendors') {
      filtered = filtered.filter(video => video.creatorType === 'vendor');
    }

    // Apply tag filter
    if (selectedTag) {
      filtered = filtered.filter(video => video.tags.includes(selectedTag));
    }

    // Apply sorting
    if (selectedFilter === 'trending') {
      filtered.sort((a, b) => (b.views + b.likes * 5) - (a.views + a.likes * 5));
    } else if (selectedFilter === 'recent') {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      // Default: mix of recent and popular
      filtered.sort((a, b) => {
        const aScore = new Date(a.createdAt).getTime() / 1000000 + a.views + a.likes * 3;
        const bScore = new Date(b.createdAt).getTime() / 1000000 + b.views + b.likes * 3;
        return bScore - aScore;
      });
    }

    return filtered;
  };

  const getAllTags = () => {
    const tagCounts: { [key: string]: number } = {};
    videos.forEach(video => {
      video.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([tag]) => tag);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        
        <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading videos...</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredVideos = getFilteredVideos();
  const popularTags = getAllTags();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      
      
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Watch</h1>
                <p className="text-gray-600">Discover design content from creators</p>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden bg-white border border-gray-300 rounded-xl px-4 py-2 flex items-center gap-2 text-gray-700 hover:bg-gray-50"
              >
                <FaFilter className="w-4 h-4" />
                Filters
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
              <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search videos, creators, or topics..."
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              />
            </div>

            {/* Filter Tabs */}
            <div className={`lg:block ${showFilters ? 'block' : 'hidden'} mb-6`}>
              <div className="flex flex-wrap gap-2 mb-4">
                {filters.map((filter) => {
                  const Icon = filter.icon;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedFilter(filter.id as any)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                        selectedFilter === filter.id
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              {/* Popular Tags */}
              {popularTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-gray-500 py-2">Popular:</span>
                  {popularTags.slice(0, 8).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                      className={`px-3 py-1 rounded-full text-sm transition-all ${
                        selectedTag === tag
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Results Count */}
          <div className="mb-6">
            <p className="text-gray-600">
              {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''} found
              {searchTerm && ` for "${searchTerm}"`}
              {selectedTag && ` tagged with "${selectedTag}"`}
            </p>
          </div>

          {/* Video Grid */}
          {filteredVideos.length === 0 ? (
            <div className="text-center py-16">
              <FaVideo className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No videos found</h3>
              <p className="text-gray-600">Try adjusting your filters or search terms</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence>
                {filteredVideos.map((video, index) => {
                  const creator = creators[video.creatorId];
                  
                  return (
                    <motion.div
                      key={video.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
                    >
                      <Link href={`/watch/${video.id}`}>
                        {/* Video Thumbnail */}
                        <div className="relative aspect-video bg-gray-200 overflow-hidden">
                          {video.videoUrl.includes('youtube') || video.videoUrl.includes('vimeo') ? (
                            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                              <FaPlay className="w-12 h-12 text-white opacity-80" />
                            </div>
                          ) : (
                            <video
                              src={video.videoUrl}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              onMouseEnter={(e) => e.currentTarget.play()}
                              onMouseLeave={(e) => e.currentTarget.pause()}
                            />
                          )}
                          
                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300">
                            <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300">
                              <FaPlay className="w-6 h-6 text-gray-800 ml-1" />
                            </div>
                          </div>

                          {/* Duration Badge */}
                          <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                            {formatDuration(Math.floor(Math.random() * 300) + 60)}
                          </div>

                          {/* Creator Type Badge */}
                          <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium ${
                            video.creatorType === 'designer' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {video.creatorType === 'designer' ? 'Designer' : 'Vendor'}
                          </div>
                        </div>

                        {/* Video Info */}
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {video.title}
                          </h3>
                          
                          {/* Creator Info */}
                          {creator && (
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 relative rounded-full overflow-hidden">
                                <Image
                                  src={creator.profileImage}
                                  alt={creator.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                              <span className="text-sm text-gray-600 font-medium">
                                {creator.name}
                              </span>
                            </div>
                          )}

                          {/* Video Stats */}
                          <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <FaEye className="w-3 h-3" />
                                {formatViews(video.views)}
                              </div>
                              <div className="flex items-center gap-1">
                                <FaHeart className="w-3 h-3" />
                                {video.likes}
                              </div>
                            </div>
                            <span>{formatTimeAgo(video.createdAt)}</span>
                          </div>

                          {/* Tags */}
                          {video.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {video.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                                >
                                  #{tag}
                                </span>
                              ))}
                              {video.tags.length > 3 && (
                                <span className="text-xs text-gray-400">
                                  +{video.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* AI Quote Preview */}
                          {video.pullQuotes && video.pullQuotes.length > 0 && (
                            <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                              <p className="text-xs text-blue-700 italic">
                                "{video.pullQuotes[0].text.substring(0, 80)}..."
                              </p>
                            </div>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    
      </div>
      </div></div>
  );
} 