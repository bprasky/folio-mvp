'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaInstagram, FaGlobe, FaEnvelope, FaPhone, FaCalendarAlt } from 'react-icons/fa';

// Mock data - replace with actual data fetching later
const designerData = {
  name: 'Diana Matta',
  title: 'Principal Designer',
  location: 'San Francisco, CA',
  studio: 'Matta Design Studio',
  experience: 15,
  bio: 'Award-winning interior designer with a passion for creating timeless, sophisticated spaces that reflect the unique personality of each client.',
  profileImage: '/images/designers/diana-matta.jpg',
  social: {
    instagram: 'https://instagram.com/dianamatta',
    website: 'https://dianamatta.com',
  },
  badges: [
    { type: 'platform', name: 'Top 10 Trending Designer', icon: '🏆' },
    { type: 'platform', name: "Editor's Pick", icon: '⭐' },
    { type: 'media', name: 'Architectural Digest', icon: '/images/badges/ad.png' },
    { type: 'media', name: 'Elle Decor', icon: '/images/badges/elle.png' },
  ],
  featuredProjects: [
    {
      id: 1,
      title: 'Modern Coastal Villa',
      image: '/images/projects/coastal-villa.jpg',
      link: '/project/coastal-villa',
    },
  ],
  contact: {
    email: 'hello@dianamatta.com',
    phone: '+1 (415) 555-0123',
  },
};

export default function DesignerProfile({ params }: { params: { slug: string } }) {
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold">Designer Profile</h1>
      <p className="mt-4">Slug: {params.slug}</p>
    </div>
  );
} 