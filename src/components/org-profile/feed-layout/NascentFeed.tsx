'use client';

import { motion } from 'framer-motion';
import type { FeedProjectItem } from '@/lib/feed/feed-layout';
import FeaturedProjectCard from './FeaturedProjectCard';

interface NascentFeedProps {
  projects: FeedProjectItem[];
}

export default function NascentFeed({ projects }: NascentFeedProps) {
  return (
    <div className="space-y-6">
      {projects.map((project, index) => (
        <motion.div
          key={project.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08, duration: 0.35 }}
        >
          <FeaturedProjectCard project={project} />
        </motion.div>
      ))}
    </div>
  );
}
