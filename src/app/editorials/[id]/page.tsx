'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, Heart, Share2, Eye, ArrowLeft, Tag } from 'lucide-react';

interface Editorial {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  author: string;
  publishDate: string;
  category: string;
  tags: string[];
  heroImage: string;
  gallery: string[];
  views: number;
  likes: number;
  shares: number;
}

export default function EditorialPage() {
  const params = useParams();
  const [editorial, setEditorial] = useState<Editorial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEditorial = async () => {
      try {
        // Mock editorial data
        const mockEditorial: Editorial = {
          id: params.id as string,
          title: 'The Future of Sustainable Luxury Design',
          subtitle: 'How eco-conscious materials are reshaping high-end interiors',
          content: `
            <p>In the ever-evolving world of luxury interior design, sustainability has emerged as the defining trend of our generation. No longer is luxury defined solely by opulence and excess; today's discerning clients demand spaces that are as environmentally conscious as they are aesthetically stunning.</p>
            
            <h2>The Rise of Eco-Luxury</h2>
            <p>The concept of "eco-luxury" represents a paradigm shift in how we think about high-end design. It's about creating spaces that are not only beautiful but also responsible—spaces that honor both the client's desire for sophistication and our collective responsibility to the planet.</p>
            
            <p>Leading designers are increasingly turning to innovative materials that offer both luxury and sustainability. From reclaimed wood that tells a story to recycled metals that gleam with new purpose, these materials are proving that environmental responsibility and aesthetic excellence are not mutually exclusive.</p>
            
            <h2>Innovative Materials Leading the Way</h2>
            <p>One of the most exciting developments in sustainable luxury design is the emergence of bio-based materials. These innovative products, derived from renewable resources like bamboo, cork, and even mushroom mycelium, are revolutionizing what's possible in high-end interiors.</p>
            
            <p>Take, for example, the work of renowned designer Diana Matta, whose recent project in Tribeca showcases how sustainable materials can create spaces of unparalleled elegance. "The key," she explains, "is not just choosing eco-friendly materials, but selecting those that enhance the overall design narrative."</p>
          `,
          author: 'Sarah Chen',
          publishDate: '2024-01-15',
          category: 'Design Trends',
          tags: ['Sustainability', 'Luxury Design', 'Eco-Friendly', 'Materials'],
          heroImage: '/images/editorials/sustainable-luxury-hero.jpg',
          gallery: [
            '/images/editorials/sustainable-luxury-1.jpg',
            '/images/editorials/sustainable-luxury-2.jpg',
            '/images/editorials/sustainable-luxury-3.jpg'
          ],
          views: 15420,
          likes: 892,
          shares: 156
        };
        
        setEditorial(mockEditorial);
      } catch (error) {
        console.error('Error fetching editorial:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEditorial();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!editorial) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Editorial Not Found</h1>
          <p className="text-gray-600 mb-8">The editorial you're looking for doesn't exist.</p>
          <Link href="/editorials" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Browse All Editorials
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative h-96 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        <div className="relative z-10 container mx-auto px-4 py-8">
          <div className="flex items-center space-x-4 mb-6">
            <Link href="/editorials" className="text-white hover:text-blue-200 transition-colors flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Editorials
            </Link>
          </div>
          
          <div className="max-w-4xl">
            <div className="inline-block px-3 py-1 bg-blue-600 text-white text-sm rounded-full mb-4">
              {editorial.category}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              {editorial.title}
            </h1>
            <p className="text-xl text-blue-100 mb-6">
              {editorial.subtitle}
            </p>
            
            <div className="flex items-center space-x-6 text-white">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date(editorial.publishDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4" />
                <span>{editorial.views.toLocaleString()} views</span>
              </div>
              <div className="flex items-center space-x-2">
                <Heart className="w-4 h-4" />
                <span>{editorial.likes} likes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Author Info */}
          <div className="flex items-center space-x-4 mb-8 p-6 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {editorial.author.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{editorial.author}</p>
              <p className="text-gray-600 text-sm">Contributing Editor</p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center space-x-2 mb-8">
            <Tag className="w-4 h-4 text-gray-400" />
            {editorial.tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Hero Image */}
          <div className="relative h-96 mb-8 rounded-xl overflow-hidden">
            <Image
              src={editorial.heroImage}
              alt={editorial.title}
              fill
              className="object-cover"
            />
          </div>

          {/* Article Content */}
          <article className="prose prose-lg max-w-none">
            <div dangerouslySetInnerHTML={{ __html: editorial.content }} />
          </article>

          {/* Gallery */}
          <div className="mt-12">
            <h3 className="text-2xl font-bold mb-6">Gallery</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {editorial.gallery.map((image, index) => (
                <div key={index} className="relative h-64 rounded-lg overflow-hidden">
                  <Image
                    src={image}
                    alt={`Gallery image ${index + 1}`}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Share Section */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Heart className="w-4 h-4" />
                  <span>Like</span>
                </button>
                <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
              
              <div className="text-sm text-gray-500">
                {editorial.shares} shares
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 