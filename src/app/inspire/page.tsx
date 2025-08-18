'use client';

import { useState, useEffect } from 'react';
import InspireCard from '@/components/inspire/InspireCard';
import { motion, AnimatePresence } from 'framer-motion';
import inspireData from '@/data/inspire_posts.json';

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

  // Simulate fetching posts
  const fetchPosts = async () => {
    setLoading(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newPosts = inspireData.posts.map(post => ({
      ...post,
      id: `${post.id}_${page}`,
      projectLink: (post.id === '1') ? '/project/modern-living-room' : undefined,
      productLink: (post.id === '1') ? '/product/eco-modular-sofa' : undefined,
      designerLink: (post.id === '1') ? '/designer/diana-matta' : (post.id === '2') ? '/designer/nu-projects' : undefined,
    })) as InspirePost[];
    
    setPosts(prev => [...prev, ...newPosts]);
    setPage(prev => prev + 1);
    setLoading(false);
  };

  // Initial load
  useEffect(() => {
    fetchPosts();
  }, []);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop
        >= document.documentElement.offsetHeight - 100 // Load more 100px before reaching bottom
      ) {
        fetchPosts();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-primary flex">
      {/* Navigation */}
      

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
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

          {/* Placeholder for when no more posts are available (optional) */}
          {!loading && posts.length > 0 && page > 3 && (
            <div className="text-center text-light mt-8">
              You've reached the end of the feed!
            </div>
          )}
        </div>
      </div>
    
      </div></div>
  );
} 