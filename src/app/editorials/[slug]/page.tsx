'use client';

import { useState } from 'react';
import Link from 'next/link';
import SafeImage from '../../../components/SafeImage';
import Navigation from '../../../components/Navigation';
import { FaClock, FaEye, FaShare, FaBookmark, FaArrowLeft, FaExternalLinkAlt, FaInstagram, FaLinkedin, FaGlobe } from 'react-icons/fa';

// Sample editorial data - in production this would be fetched by slug
const getEditorialBySlug = (slug: string) => {
  const editorials = {
    'waterfront-retreat-balinese-luxury': {
      id: 'waterfront-retreat-editorial',
      slug: 'waterfront-retreat-balinese-luxury',
      title: 'Waterfront Retreat: Contemporary Balinese Luxury',
      subtitle: 'A 12,000 SF custom home that captures the essence of modern tropical living',
      intro: 'Inspired by its location on Sunset Lake, a yacht basin boasting the calmest body of water on the beach, this spectacular custom waterfront home resonates with calming energy. The interior design captures the contemporary Balinese essence of its architecture through natural materials, warm color palettes, modern organic furnishings, and carefully curated art throughout this luxury resort-style residence.',
      heroImage: 'https://cdn.prod.website-files.com/66f42e113b610c9213331fbc/6706e5e91623c8ee4599a93b_img-1.jpg',
      designerName: 'Sarah Chen',
      designerImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b5c5?auto=format&fit=crop&w=150&q=80',
      designerTagline: 'Creating timeless spaces that blend luxury with natural harmony',
      designerBio: 'With over 15 years of experience in high-end residential design, Sarah specializes in creating sophisticated spaces that honor their natural surroundings while delivering uncompromising luxury.',
      category: 'Residential',
      readTime: '8 min read',
      views: 2847,
      publishedAt: '2024-01-15',
      quoteBlocks: [
        {
          image: 'https://cdn.prod.website-files.com/66f42e113b610c9213331fbc/66f704047ab99f998836ce7c_img-3.avif',
          quote: 'The grand room is designed with multiple entertainment areas where sinuous sofas and sculptural armchairs surround round coffee tables in various styles from wood to glass.',
          attribution: 'Sarah Chen, Lead Designer'
        },
        {
          image: 'https://cdn.prod.website-files.com/66f42e113b610c9213331fbc/66f70404ba30530f5439427c_img-4.avif',
          quote: 'Natural colors like sand and woods showcase the styling of each piece, from the open cane seat backs in the armchairs to the drum style coffee table in wood.',
          attribution: 'Design Philosophy'
        }
      ],
      products: [
        {
          name: 'Teak Dining Table',
          vendor: 'West Elm',
          price: '$2,499',
          image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=300&q=80',
          url: 'https://westelm.com',
          room: 'Dining Room'
        },
        {
          name: 'Rattan Lounge Chair',
          vendor: 'CB2',
          price: '$899',
          image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=300&q=80',
          url: 'https://cb2.com',
          room: 'Living Room'
        },
        {
          name: 'Natural Stone Vase',
          vendor: 'Pottery Barn',
          price: '$149',
          image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=300&q=80',
          url: 'https://potterybarn.com',
          room: 'Entryway'
        },
        {
          name: 'Organic Cotton Throw',
          vendor: 'Parachute',
          price: '$199',
          image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=300&q=80',
          url: 'https://parachutehome.com',
          room: 'Living Room'
        }
      ],
      videoUrl: null,
      tags: ['Luxury', 'Waterfront', 'Contemporary', 'Tropical'],
      socialLinks: {
        instagram: 'https://instagram.com/sarahchendesign',
        linkedin: 'https://linkedin.com/in/sarahchendesign',
        website: 'https://sarahchendesign.com'
      }
    }
  };

  return editorials[slug as keyof typeof editorials] || null;
};

interface EditorialDetailProps {
  params: {
    slug: string;
  };
}

export default function EditorialDetail({ params }: EditorialDetailProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const editorial = getEditorialBySlug(params.slug);

  if (!editorial) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Navigation />
        <div className="flex-1 lg:ml-20 xl:ml-56 overflow-y-auto flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Editorial Not Found</h1>
            <Link href="/editorials" className="text-blue-600 hover:text-blue-800">
              ← Back to Editorials
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: editorial.title,
        text: editorial.subtitle,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56 overflow-y-auto">
        <article className="max-w-4xl mx-auto">
          {/* Header Navigation */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-10">
            <div className="flex items-center justify-between p-6">
              <Link href="/editorials" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <FaArrowLeft className="w-4 h-4" />
                <span>Back to Editorials</span>
              </Link>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <FaShare className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </button>
                <button
                  onClick={() => setIsBookmarked(!isBookmarked)}
                  className={`flex items-center gap-2 px-4 py-2 transition-colors ${
                    isBookmarked ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FaBookmark className="w-4 h-4" />
                  <span className="hidden sm:inline">Save</span>
                </button>
              </div>
            </div>
          </div>

          {/* Hero Section */}
          <div className="relative">
            <div className="relative h-[70vh] overflow-hidden">
              <SafeImage
                src={editorial.heroImage}
                alt={editorial.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                      {editorial.category}
                    </span>
                    <div className="flex items-center gap-4 text-sm text-gray-300">
                      <div className="flex items-center gap-1">
                        <FaClock className="w-4 h-4" />
                        <span>{editorial.readTime}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FaEye className="w-4 h-4" />
                        <span>{editorial.views.toLocaleString()} views</span>
                      </div>
                    </div>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-4">{editorial.title}</h1>
                  <p className="text-xl text-gray-200 max-w-3xl">{editorial.subtitle}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-12">
            {/* Intro */}
            <div className="max-w-3xl mx-auto">
              <p className="text-lg leading-relaxed text-gray-700 font-light">
                {editorial.intro}
              </p>
            </div>

            {/* Quote Blocks Section */}
            <div className="space-y-16">
              {editorial.quoteBlocks.map((block, idx) => (
                <div key={idx} className={`grid md:grid-cols-2 gap-12 items-center ${idx % 2 === 1 ? 'md:grid-flow-col-dense' : ''}`}>
                  <div className={`space-y-6 ${idx % 2 === 1 ? 'md:col-start-2' : ''}`}>
                    <blockquote className="text-2xl font-light italic text-gray-800 leading-relaxed">
                      "{block.quote}"
                    </blockquote>
                    <cite className="text-sm text-gray-500 not-italic">— {block.attribution}</cite>
                  </div>
                  <div className={`${idx % 2 === 1 ? 'md:col-start-1 md:row-start-1' : ''}`}>
                    <SafeImage
                      src={block.image}
                      alt={`Design detail ${idx + 1}`}
                      className="w-full h-80 object-cover rounded-2xl shadow-lg"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Featured Materials Section */}
            <div className="bg-gray-50 -mx-8 px-8 py-12 rounded-2xl">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Featured Materials & Products</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {editorial.products.map((product, idx) => (
                  <div key={idx} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group">
                    <div className="relative mb-4">
                      <SafeImage
                        src={product.image}
                        alt={product.name}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-gray-600">
                        {product.room}
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{product.name}</h3>
                    <p className="text-gray-600 text-sm mb-2">{product.vendor}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg text-gray-900">{product.price}</span>
                      <a 
                        href={product.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                      >
                        Shop <FaExternalLinkAlt className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Designer Profile & CTA */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                <SafeImage
                  src={editorial.designerImage}
                  alt={editorial.designerName}
                  className="w-24 h-24 rounded-full object-cover"
                />
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{editorial.designerName}</h3>
                  <p className="text-lg text-blue-600 mb-4">{editorial.designerTagline}</p>
                  <p className="text-gray-600 mb-6">{editorial.designerBio}</p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                    <button className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors">
                      View Full Portfolio
                    </button>
                    <button className="border border-gray-900 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-900 hover:text-white transition-colors">
                      Schedule Consultation
                    </button>
                  </div>
                  
                  <div className="flex gap-4 mt-6 justify-center md:justify-start">
                    <a href={editorial.socialLinks.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors">
                      <FaGlobe className="w-5 h-5" />
                    </a>
                    <a href={editorial.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors">
                      <FaInstagram className="w-5 h-5" />
                    </a>
                    <a href={editorial.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors">
                      <FaLinkedin className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-3 justify-center">
              {editorial.tags.map(tag => (
                <span key={tag} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full text-sm font-medium">
                  #{tag}
                </span>
              ))}
            </div>

            {/* Related Editorials */}
            <div className="border-t border-gray-200 pt-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">More Editorial Features</h3>
              <div className="text-center">
                <Link href="/editorials" className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors">
                  Explore All Editorials
                </Link>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
} 