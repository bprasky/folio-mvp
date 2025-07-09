'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, Instagram, Linkedin, Globe, Mail, Phone, Star, Heart, Share2, Eye, Download } from 'lucide-react';

interface Designer {
  id: string;
  name: string;
  bio: string;
  profileImage: string;
  location: string;
  specialties: string[];
  website?: string;
  instagram?: string;
  linkedin?: string;
  followers: number;
  views: number;
  projects: Project[];
}

interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  client: string;
  thumbnail: string;
  views: number;
  saves: number;
  shares: number;
}

export default function DesignerProfile() {
  const params = useParams();
  const [designer, setDesigner] = useState<Designer | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('projects');

  useEffect(() => {
    const fetchDesigner = async () => {
      try {
        // For now, we'll use a mock designer since we're using ID-based routing
        const mockDesigner: Designer = {
          id: params.id as string,
          name: 'Diana Matta',
          bio: 'Award-winning interior designer specializing in sustainable luxury residential projects. Known for creating timeless spaces that blend contemporary aesthetics with environmental consciousness.',
          profileImage: '/images/designers/diana-matta.jpg',
          location: 'New York, NY',
          specialties: ['Luxury Residential', 'Sustainable Design', 'Contemporary', 'Minimalist'],
          website: 'https://dianamatta.com',
          instagram: '@dianamatta_design',
          linkedin: 'diana-matta-interior-design',
          followers: 12450,
          views: 89230,
          projects: [
            {
              id: 'project-1',
              name: 'Modern Minimalist Loft',
              description: 'A 2,500 sq ft luxury loft renovation in Tribeca featuring sustainable materials and smart home technology.',
              category: 'Residential',
              client: 'Private Client',
              thumbnail: '/images/projects/modern-loft-1.jpg',
              views: 15420,
              saves: 892,
              shares: 156
            },
            {
              id: 'project-2',
              name: 'Eco-Friendly Family Home',
              description: 'A 4,000 sq ft family home in the Hamptons with solar panels, rainwater harvesting, and organic landscaping.',
              category: 'Residential',
              client: 'Green Family',
              thumbnail: '/images/projects/eco-home-1.jpg',
              views: 12340,
              saves: 756,
              shares: 98
            }
          ]
        };
        
        setDesigner(mockDesigner);
      } catch (error) {
        console.error('Error fetching designer:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDesigner();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!designer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Designer Not Found</h1>
          <p className="text-gray-600 mb-8">The designer you're looking for doesn't exist.</p>
          <Link href="/designer" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Browse All Designers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="relative h-96 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="absolute inset-0 bg-black bg-opacity-30"></div>
        <div className="relative z-10 container mx-auto px-4 py-8">
          <div className="flex items-center space-x-4 mb-6">
            <Link href="/designer" className="text-white hover:text-blue-200 transition-colors">
              ← Back to Designers
            </Link>
          </div>
          
          <div className="flex items-end space-x-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                <Image
                  src={designer.profileImage}
                  alt={designer.name}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            <div className="flex-1 text-white">
              <h1 className="text-4xl font-bold mb-2">{designer.name}</h1>
              <p className="text-xl mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                {designer.location}
              </p>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>{designer.views.toLocaleString()} views</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Heart className="w-5 h-5" />
                  <span>{designer.followers.toLocaleString()} followers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">About</h3>
              <p className="text-gray-600 mb-6">{designer.bio}</p>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Specialties</h4>
                  <div className="flex flex-wrap gap-2">
                    {designer.specialties.map((specialty, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Contact</h4>
                  <div className="space-y-2">
                    {designer.website && (
                      <a
                        href={designer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        Website
                      </a>
                    )}
                    {designer.instagram && (
                      <a
                        href={`https://instagram.com/${designer.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-pink-600 hover:text-pink-800 transition-colors"
                      >
                        <Instagram className="w-4 h-4 mr-2" />
                        {designer.instagram}
                      </a>
                    )}
                    {designer.linkedin && (
                      <a
                        href={`https://linkedin.com/in/${designer.linkedin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-blue-700 hover:text-blue-900 transition-colors"
                      >
                        <Linkedin className="w-4 h-4 mr-2" />
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  <button
                    onClick={() => setActiveTab('projects')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'projects'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Projects ({designer.projects.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'reviews'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Reviews (12)
                  </button>
                  <button
                    onClick={() => setActiveTab('articles')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'articles'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Articles (3)
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'projects' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {designer.projects.map((project) => (
                      <div key={project.id} className="bg-gray-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        <div className="relative h-48">
                          <Image
                            src={project.thumbnail}
                            alt={project.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
                          <p className="text-gray-600 text-sm mb-3">{project.description}</p>
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>{project.category}</span>
                            <div className="flex items-center space-x-4">
                              <span className="flex items-center">
                                <Eye className="w-4 h-4 mr-1" />
                                {project.views.toLocaleString()}
                              </span>
                              <span className="flex items-center">
                                <Heart className="w-4 h-4 mr-1" />
                                {project.saves}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Reviews coming soon...</p>
                  </div>
                )}

                {activeTab === 'articles' && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Articles coming soon...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 