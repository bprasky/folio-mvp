'use client';

import { useState, useEffect, useCallback } from 'react';
import InspireCard from '@/components/inspire/InspireCard';
import { motion, AnimatePresence } from 'framer-motion';
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
  projectLink?: string;
  productLink?: string;
  designerLink?: string;
}

export default function InspirePage() {
  const [posts, setPosts] = useState<InspirePost[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Fetch posts from API
  const fetchPosts = useCallback(async (pageNum: number) => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/inspire?page=${pageNum}`);
      const data = await response.json();
      
      if (data.posts && data.posts.length > 0) {
        setPosts(prev => [...prev, ...data.posts]);
        setPage(prev => prev + 1);
        setHasMore(data.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to fetch inspire posts:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore]);

  // Initial load
  useEffect(() => {
    fetchPosts(1);
  }, []);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop
        >= document.documentElement.offsetHeight - 100 && // Load more 100px before reaching bottom
        !loading &&
        hasMore
      ) {
        fetchPosts(page);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore, page, fetchPosts]);

  return (
    <div className="min-h-screen bg-primary flex">
      {/* Navigation */}
      {/* Main Content */}
      <div className="flex-1   p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-secondary">Inspire</h1>
          
          {/* Masonry Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-min grid-flow-row-dense">
            <AnimatePresence>
              {posts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={`
                    ${post.type === 'featured' ? 'md:col-span-2 md:row-span-2' : ''}
                    ${post.type === 'boosted' ? 'md:col-span-2' : ''}
                    ${post.type === 'viral' ? 'md:row-span-2' : ''}
                  `}
                >
                  <InspireCard post={post} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
            </div>
          )}

          {/* Placeholder for when no more posts are available */}
          {!loading && !hasMore && posts.length > 0 && (
            <div className="text-center text-light mt-8">
              You've reached the end of the feed!
            </div>
          )}
          
          {/* No posts message */}
          {!loading && posts.length === 0 && (
            <div className="text-center text-light mt-8">
              No posts found. Start creating projects to see them here!
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 