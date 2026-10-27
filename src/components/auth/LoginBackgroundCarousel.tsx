'use client';

import React, { useState, useEffect } from 'react';
import Image from '@/components/FolioImage';

interface HeroImage {
  src: string;
  alt: string;
  sourceProjectId?: string;
}

// Hard-coded room renders for MVP
// TODO: Replace with DB-driven images later
const HERO_IMAGES: HeroImage[] = [
  {
    src: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=2000&auto=format&fit=crop',
    alt: 'Modern living room with contemporary furniture',
    sourceProjectId: undefined, // Placeholder for future DB integration
  },
  {
    src: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=2000&auto=format&fit=crop',
    alt: 'Elegant dining room with natural lighting',
    sourceProjectId: undefined,
  },
  {
    src: 'https://images.unsplash.com/photo-1631889993954-6637f0e8b24e?q=80&w=2000&auto=format&fit=crop',
    alt: 'Minimalist bedroom design',
    sourceProjectId: undefined,
  },
  {
    src: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=2000&auto=format&fit=crop',
    alt: 'Luxury kitchen with marble countertops',
    sourceProjectId: undefined,
  },
];

const TRANSITION_DURATION = 5000; // 5 seconds per image
const FADE_DURATION = 1000; // 1 second crossfade

export default function LoginBackgroundCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, TRANSITION_DURATION);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden -z-10">
      {HERO_IMAGES.map((image, index) => {
        const isActive = index === currentIndex;
        
        return (
          <div
            key={index}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={index === 0} // Only prioritize first image
              className="object-cover"
              sizes="100vw"
              quality={85}
            />
            {/* Subtle dark overlay for better text contrast */}
            <div className="absolute inset-0 bg-black/20" />
          </div>
        );
      })}
    </div>
  );
}

