"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { hrefForProject, isPublished } from '@/lib/projectRoutes';

interface Project {
  id: string;
  slug?: string | null;
  title: string;
  image: string;
  city?: string | null;
  tagCount?: number;
  isPublic?: boolean | null;
  publishedAt?: Date | string | null;
}

interface EditorialMosaicProps {
  projects: Project[];
}

export default function EditorialMosaic({ projects }: EditorialMosaicProps) {
  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-folio-stone-400 font-sans mb-4">No projects yet.</p>
        <p className="text-sm text-folio-stone-500 font-sans">Create your first project to showcase your work.</p>
      </div>
    );
  }

  // Fibonacci-inspired sizing pattern
  const getSizeConfig = (index: number) => {
    const patterns = [
      { class: 'col-span-4 md:col-span-6 row-span-2', priority: 'high' },
      { class: 'col-span-2 md:col-span-3 row-span-1', priority: 'medium' },
      { class: 'col-span-2 md:col-span-3 row-span-1', priority: 'medium' },
      { class: 'col-span-2 md:col-span-3 row-span-1', priority: 'medium' },
      { class: 'col-span-2 md:col-span-3 row-span-1', priority: 'medium' },
      { class: 'col-span-4 md:col-span-6 row-span-1', priority: 'low' },
      { class: 'col-span-2 md:col-span-3 row-span-1', priority: 'medium' },
      { class: 'col-span-2 md:col-span-3 row-span-1', priority: 'medium' },
    ];
    return patterns[index % patterns.length];
  };

  return (
    <div className="grid grid-cols-4 md:grid-cols-6 gap-4 auto-rows-[200px]">
      {projects.map((project, index) => {
        const sizeConfig = getSizeConfig(index);
        const href = hrefForProject(project);
        const published = isPublished(project);
        const displayTagCount = project.tagCount ?? 0;

        return (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className={`${sizeConfig.class} group relative overflow-hidden rounded-xl bg-folio-stone-100`}
          >
            <Link
              href={href}
              className="absolute inset-0 z-10"
              aria-label={published ? `View story: ${project.title}` : `View project: ${project.title}`}
            >
              <div className="relative w-full h-full">
                <Image
                  src={project.image || '/images/product-placeholder.jpg'}
                  alt={project.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                    <h3 className="text-white font-serif text-lg md:text-xl mb-2 line-clamp-2">
                      {project.title}
                    </h3>
                    <div className="flex items-center justify-between text-white/80 text-sm">
                      <span className="font-sans">{project.city || 'Location TBD'}</span>
                      <span className="font-sans">{displayTagCount} products</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/20">
                      <span className="text-xs text-white/60 font-sans uppercase tracking-wide">
                        {published ? 'View Story' : 'View Project'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Published badge */}
                {published && (
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-folio-ink text-xs px-2 py-1 rounded-full font-sans font-medium z-20">
                    Story
                  </div>
                )}
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
